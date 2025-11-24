// Re-export functions from Supabase service
export {
  listProductCategories,
  createProductCategory,
  updateProductCategory,
  deleteProductCategory,
  toggleCategoryStatus,
  type ProductCategory,
} from '../supabase/product-categories';
