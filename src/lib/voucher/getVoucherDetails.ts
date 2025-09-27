import { getVerxioConfig } from '@/app/actions/loyalty';

export interface VoucherDetails {
  id: string;
  name: string;
  description: string;
  image: string;
  attributes: {
    voucherType: string;
    maxUses: string;
    expiryDate: string;
    merchantId: string;
    status: string;
    conditions?: string;
    valueSymbol?: string;
    [key: string]: any;
  };
  creator: string;
  owner: string;
  collectionId: string;
  voucherData: {
    type: string;
    value: number;
    status: string;
    maxUses: number;
    issuedAt: number;
    conditions: string[];
    description: string;
    expiryDate: number;
    merchantId: string;
    currentUses: number;
    transferable: boolean;
    redemptionHistory: any[];
  };
}

export const getVoucherDetails = async (voucherAddress: string): Promise<{
  success: boolean;
  data?: VoucherDetails;
  error?: string;
}> => {
  try {
    const { rpcEndpoint } = await getVerxioConfig();
    const url = rpcEndpoint;
    const options = {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        "jsonrpc": "2.0",
        "id": "1",
        "method": "getAsset",
        "params": {
          "id": voucherAddress
        }
      })
    };

    const response = await fetch(url, options);
    const data = await response.json();
    
    if (data.error) {
      return { success: false, error: data.error.message };
    }

    const asset = data.result;
    if (!asset) {
      return { success: false, error: 'Voucher not found' };
    }

    // Extract metadata
    const metadata = asset.content?.metadata;
    const attributes = metadata?.attributes || [];
    
    // Extract attributes from metadata
    const voucherTypeAttr = attributes.find((attr: any) => attr.trait_type === 'Voucher Type');
    const maxUsesAttr = attributes.find((attr: any) => attr.trait_type === 'Max Uses');
    const expiryDateAttr = attributes.find((attr: any) => attr.trait_type === 'Expiry Date');
    const merchantIdAttr = attributes.find((attr: any) => attr.trait_type === 'Merchant ID');
    const statusAttr = attributes.find((attr: any) => attr.trait_type === 'Status');
    const conditionsAttr = attributes.find((attr: any) => attr.trait_type === 'Conditions' || attr.trait_type === 'conditions');
    const assetNameAttr = attributes.find((attr: any) => attr.trait_type === 'Asset Name');
    const assetSymbolAttr = attributes.find((attr: any) => attr.trait_type === 'Asset Symbol');
    const tokenAddressAttr = attributes.find((attr: any) => attr.trait_type === 'Token Address');

    // Extract collection ID from grouping
    const collectionGrouping = asset.grouping?.find((group: any) => group.group_key === 'collection');
    const collectionId = collectionGrouping?.group_value || '';

    // Extract voucher data from external plugins
    const externalPlugins = asset.external_plugins || [];
    const appDataPlugin = externalPlugins.find((plugin: any) => plugin.type === 'AppData');
    const voucherData = appDataPlugin?.data || {
      type: '',
      value: 0,
      status: 'active',
      maxUses: 1,
      issuedAt: 0,
      conditions: [],
      description: '',
      expiryDate: 0,
      merchantId: '',
      currentUses: 0,
      transferable: true,
      redemptionHistory: []
    };

    const voucherDetails: VoucherDetails = {
      id: asset.id,
      name: metadata?.name || 'Unknown Voucher',
      description: metadata?.description || '',
      image: asset.content?.links?.image || '',
      attributes: {
        voucherType: voucherTypeAttr?.value || '',
        maxUses: maxUsesAttr?.value || '1',
        expiryDate: expiryDateAttr?.value || '',
        merchantId: merchantIdAttr?.value || '',
        status: statusAttr?.value || 'Active',
        conditions: conditionsAttr?.value || '',
        valueSymbol: assetSymbolAttr?.value || '',
        'Asset Name': assetNameAttr?.value || '',
        'Asset Symbol': assetSymbolAttr?.value || '',
        'Token Address': tokenAddressAttr?.value || ''
      },
      creator: asset.ownership?.owner || '',
      owner: asset.ownership?.owner || '',
      collectionId: collectionId,
      voucherData: {
        type: voucherData.type || '',
        value: voucherData.value || 0,
        status: voucherData.status || 'active',
        maxUses: voucherData.max_uses || 1,
        issuedAt: voucherData.issued_at || 0,
        conditions: voucherData.conditions || [],
        description: voucherData.description || '',
        expiryDate: voucherData.expiry_date || 0,
        merchantId: voucherData.merchant_id || '',
        currentUses: voucherData.current_uses || 0,
        transferable: voucherData.transferable || true,
        redemptionHistory: voucherData.redemption_history || []
      }
    };

    return { success: true, data: voucherDetails };
  } catch (error) {
    console.error('Error fetching voucher details:', error);
    return { success: false, error: 'Failed to fetch voucher details' };
  }
};
