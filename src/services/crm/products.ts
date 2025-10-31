// Re-export functions from Supabase service
export {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductStatus,
  type Product,
} from '../supabase/products';
