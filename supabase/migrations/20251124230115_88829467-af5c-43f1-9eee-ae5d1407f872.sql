-- Criar bucket para imagens de produtos
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true);

-- Políticas RLS para o bucket product-images
CREATE POLICY "Users can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Users can upload product images in their org"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update their org product images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product-images' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete their org product images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product-images' AND
  auth.uid() IS NOT NULL
);