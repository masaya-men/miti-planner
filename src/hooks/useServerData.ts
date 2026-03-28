/**
 * サーバーデータアクセスフック
 * Firestoreから取得したDC/サーバーデータを返し、未取得時は静的ファイルにフォールバック
 */
import { useMasterDataStore } from '../store/useMasterDataStore';
import type { MasterServers } from '../types';
import {
  serverMasterData,
  housingAreaMasterData,
  housingSizeMasterData,
  tagMasterData,
} from '../data/masterData';

const STATIC_SERVERS: MasterServers = {
  datacenters: serverMasterData,
  housingAreas: housingAreaMasterData,
  housingSizes: housingSizeMasterData,
  tags: tagMasterData,
};

/** Reactフック */
export function useServerData(): MasterServers {
  const servers = useMasterDataStore((s) => s.servers);
  return servers ?? STATIC_SERVERS;
}

/** 非Reactコンテキスト用 */
export function getServerDataFromStore(): MasterServers {
  return useMasterDataStore.getState().servers ?? STATIC_SERVERS;
}
