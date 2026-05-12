import { 
  collection, 
  query, 
  where, 
  getDocs, 
  runTransaction, 
  doc, 
  getDoc,
  serverTimestamp, 
  addDoc 
} from 'firebase/firestore';
import { db } from './firebase';

export interface StockUsage {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  itemType: 'ingredients' | 'packaging';
}

/**
 * Calculates required ingredients and packaging based on menu recipes.
 */
export async function calculateRequiredItems(menuItems: { menuId: string, quantity: number }[]): Promise<StockUsage[]> {
  const usage: Record<string, StockUsage> = {};

  for (const item of menuItems) {
    const q = query(collection(db, 'menu_recipes'), where('menuId', '==', item.menuId));
    const recipeSnap = await getDocs(q);
    
    recipeSnap.forEach(rDoc => {
      const recipe = rDoc.data();
      const totalNeeded = recipe.quantityNeeded * item.quantity;
      const key = `${recipe.itemType || 'ingredients'}_${recipe.ingredientId}`;
      
      if (usage[key]) {
        usage[key].quantity += totalNeeded;
      } else {
        usage[key] = {
          id: recipe.ingredientId,
          name: recipe.ingredientName,
          quantity: totalNeeded,
          unit: recipe.unit,
          itemType: (recipe.itemType as 'ingredients' | 'packaging') || 'ingredients'
        };
      }
    });
  }

  return Object.values(usage);
}

/**
 * Deducts stock from Firestore and ensures it's only done once per order.
 */
export async function deductStockForOrder(orderId: string, menuItems: any[]) {
  return await runTransaction(db, async (transaction) => {
    const orderRef = doc(db, 'orders', orderId);
    const orderDoc = await transaction.get(orderRef);

    if (!orderDoc.exists()) throw new Error('Order not found');
    if (orderDoc.data().stockDeducted) return { alreadyDeducted: true };

    const requiredItems = await calculateRequiredItems(menuItems);
    const stockUpdates: any[] = [];

    // 1. Check all stock
    for (const req of requiredItems) {
      const collectionName = req.itemType === 'packaging' ? 'packaging' : 'ingredients';
      const itemRef = doc(db, collectionName, req.id);
      const itemDoc = await transaction.get(itemRef);

      if (!itemDoc.exists()) throw new Error(`${req.itemType === 'packaging' ? 'Kemasan' : 'Bahan'} ${req.name} tidak ditemukan`);

      const currentQty = itemDoc.data().quantity || 0;
      if (currentQty < req.quantity) {
        throw new Error(`Stok tidak cukup untuk ${req.name}. Tersedia: ${currentQty}, Dibutuhkan: ${req.quantity}`);
      }

      stockUpdates.push({
        ref: itemRef,
        prevQty: currentQty,
        usedQty: req.quantity,
        newQty: currentQty - req.quantity,
        name: req.name,
        threshold: itemDoc.data().minimumThreshold || 0,
        itemType: req.itemType
      });
    }

    // 2. Apply updates and logs
    for (const update of stockUpdates) {
      const status = update.newQty <= update.threshold ? 'low stock' : 'safe';
      transaction.update(update.ref, {
        quantity: update.newQty,
        status,
        updatedAt: serverTimestamp()
      });

      const logRef = doc(collection(db, 'stock_logs'));
      transaction.set(logRef, {
        ingredientId: update.ref.id,
        ingredientName: update.name,
        previousQuantity: update.prevQty,
        usedQuantity: update.usedQty,
        remainingQuantity: update.newQty,
        orderId,
        type: update.itemType === 'packaging' ? 'packaging_usage' : 'production_usage',
        createdAt: serverTimestamp()
      });
    }

    // 3. Mark order as stock deducted
    transaction.update(orderRef, {
      stockDeducted: true,
      updatedAt: serverTimestamp()
    });

    return { alreadyDeducted: false };
  });
}

/**
 * Creates an income transaction for a completed order.
 */
export async function createIncomeTransaction(orderId: string, providedOrderData?: any) {
  try {
    const tQuery = query(collection(db, 'transactions'), where('orderId', '==', orderId));
    const tSnap = await getDocs(tQuery);

    if (!tSnap.empty) return false;

    let orderData = providedOrderData;
    if (!orderData || !orderData.totalPrice) {
      const orderRef = doc(db, 'orders', orderId);
      const orderDoc = await getDoc(orderRef);
      if (orderDoc.exists()) {
        orderData = orderDoc.data();
      }
    }

    if (!orderData) return false;

    await addDoc(collection(db, 'transactions'), {
      date: new Date().toISOString().split('T')[0],
      type: 'income',
      category: 'Pembayaran Pesanan',
      amount: orderData.totalPrice || 0,
      description: "Pesanan catering selesai",
      orderId: orderId,
      customerName: orderData.customerName || 'N/A',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error('Failed to create income transaction:', err);
    return false;
  }
}
