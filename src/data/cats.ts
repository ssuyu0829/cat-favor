import type { Cat } from '../lib/types';

/** 五隻貓的預設值。名字與顏色之後可以在「設定」裡改，這裡只是第一次啟動時的種子資料。 */
export const DEFAULT_CATS: Cat[] = [
  { id: 'jiao', name: '焦焦', color: '#b5836a', order: 0 },
  { id: 'zhao', name: '朝朝', color: '#d0a161', order: 1 },
  { id: 'mu', name: '暮暮', color: '#9a92b6', order: 2 },
  { id: 'yao', name: '咬咬', color: '#c08a97', order: 3 },
  { id: 'xiao', name: '曉曉', color: '#85a99f', order: 4 },
];
