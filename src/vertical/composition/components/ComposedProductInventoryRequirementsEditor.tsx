// NOID-VERTICAL-1.0-VERT-02.6
// Composition wrapper: resolves the Foundation policy for
// `inventory.product_requirements` and hands a neutral policy to the Core
// editor view. This is the ONLY runtime edge that knows about the
// composition boundary — the Core view remains Pack-agnostic.

import { useMemo } from 'react';
import { useInventoryProvider } from '@/inventory/hooks/useInventoryProvider';
import { ProductInventoryRequirementsEditor } from '@/components/products/ProductInventoryRequirementsEditor';
import { resolveInventoryProductRequirementsComposition } from '@/vertical/composition/inventoryProductRequirementsComposition';

interface Props {
  organizationId: string;
  productId: string;
  canEdit: boolean;
}

export function ComposedProductInventoryRequirementsEditor(props: Props) {
  const { providerType } = useInventoryProvider(props.organizationId);

  const verticalPolicy = useMemo(
    () =>
      resolveInventoryProductRequirementsComposition({
        organizationId: props.organizationId,
        activeProviderType: providerType ?? null,
      }),
    [props.organizationId, providerType],
  );

  return (
    <ProductInventoryRequirementsEditor
      organizationId={props.organizationId}
      productId={props.productId}
      canEdit={props.canEdit}
      verticalPolicy={verticalPolicy}
    />
  );
}
