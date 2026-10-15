import { relOf, type Save } from './state';

/** Truck paint jobs. Bought with coins, or unlocked by finishing a character's story. */
export interface Skin {
  id: string;
  name: string;
  trailer: [string, string]; // top / bottom of the trailer gradient
  panel: string;
  stripe: string;
  ink: string; // lettering
  cab: [string, string]; // cab body / roof
  price?: number;
  unlock?: string; // character id whose story unlocks it
  hint?: string;
}

export const SKINS: Skin[] = [
  { id: 'classic', name: 'Classic DVN', trailer: ['#ffffff', '#d6dcec'], panel: '#e6ebf7', stripe: '#ffc233', ink: '#1b2547', cab: ['#2b3a67', '#394c85'] },
  { id: 'outback', name: 'Outback Red', trailer: ['#f4a461', '#d9843c'], panel: '#e89650', stripe: '#fff3df', ink: '#6b2d12', cab: ['#7a2f1d', '#963c27'], price: 250 },
  { id: 'midnight', name: 'Midnight', trailer: ['#343c5e', '#1f2540'], panel: '#2a3150', stripe: '#2ee6c5', ink: '#e8fff9', cab: ['#0f1424', '#1c2340'], price: 500 },
  { id: 'pie', name: 'Maple’s Pie', trailer: ['#ffe4ea', '#f5bccb'], panel: '#fbd3dd', stripe: '#e56f93', ink: '#8d2d4d', cab: ['#b84a6b', '#d0607f'], unlock: 'maple', hint: "Finish Granny Maple's story" },
  { id: 'hardhat', name: 'Site Boss', trailer: ['#ffd24d', '#f0a800'], panel: '#ffc533', stripe: '#1b2547', ink: '#1b2547', cab: ['#3b3b3b', '#555555'], unlock: 'rex', hint: "Finish Rex's story" },
  { id: 'stream', name: 'Live Stream', trailer: ['#c9b6ff', '#9a7bf0'], panel: '#b49cf8', stripe: '#2ee6c5', ink: '#2a1a5e', cab: ['#4b3a8f', '#5f4cae'], unlock: 'pixel', hint: "Finish Pixel's story" },
  { id: 'vet', name: 'Vet Van', trailer: ['#c7f5e6', '#7fdcc0'], panel: '#aaeedb', stripe: '#ffffff', ink: '#0d5c4a', cab: ['#1e8f74', '#2aa88a'], unlock: 'doc', hint: "Finish Dr. Whiskers' story" },
  { id: 'captain', name: 'Captain’s Rig', trailer: ['#2c4a7c', '#1d3557'], panel: '#26426f', stripe: '#ffc233', ink: '#fff4d1', cab: ['#f4f4f4', '#d9dde8'], unlock: 'cap', hint: "Finish Captain Nemo's story" },
];

export const skinById = (id: string): Skin => SKINS.find((s) => s.id === id) ?? SKINS[0];

export const skinOwned = (s: Save, k: Skin): boolean => k.id === 'classic' || s.owned.includes(k.id) || (!!k.unlock && relOf(s, k.unlock).beats >= 3);
