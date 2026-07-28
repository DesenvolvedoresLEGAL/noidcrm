// NOID-VERTICAL-1.0-VERT-02.6
// Connectivity Pack contribution for the `inventory.product_requirements`
// canonical capability. First real Pack contribution served end-to-end
// through the Vertical Foundation.
//
// Presentation strings intentionally mirror the historical Core view copy
// byte-for-byte (VERT-02.6 requires zero user-visible regression).

import {
  declareExtensionContribution,
  parsePackId,
  type ExtensionContributionDeclaration,
} from '@/vertical/foundation';
import {
  inventoryProductRequirementsSurface,
  type InventoryProductRequirementsContribution,
} from '@/vertical/hosts/inventoryProductRequirementsSurface';

const CONNECTIVITY_PACK_ID = parsePackId('connectivity');
const CONNECTIVITY_PACK_VERSION = 'v1';
const SOURCE_PATH =
  'src/vertical-packs/connectivity/inventory/productRequirementsContribution.ts';

export const connectivityInventoryProductRequirementsContribution: ExtensionContributionDeclaration<InventoryProductRequirementsContribution> =
  declareExtensionContribution(
    inventoryProductRequirementsSurface,
    {
      packId: CONNECTIVITY_PACK_ID,
      packVersion: CONNECTIVITY_PACK_VERSION,
      sourcePath: SOURCE_PATH,
    },
    {
      supportedProviderTypes: ['eventrix'],
      defaultUnitBasis: 'per_point',
      presentation: {
        consumptionExample:
          'A quantidade representa o consumo físico por base comercial. Ex.: 1 roteador por ponto.',
        requirementLabelPlaceholder: 'Ex: Roteador 5G Indoor',
        notesPlaceholder: 'Ex: Usado em pontos de conectividade indoor.',
      },
    },
  );
