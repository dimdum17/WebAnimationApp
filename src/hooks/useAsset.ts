import { useSyncExternalStore } from 'react';
import { assetVersion, getLoadedAsset, subscribeAssets, isAssetFailed } from '@/persistence/assets';

export function useAsset(id: string | null | undefined) {
  useSyncExternalStore(subscribeAssets, assetVersion);
  const asset = getLoadedAsset(id);
  return { asset, failed: id ? isAssetFailed(id) : false };
}
