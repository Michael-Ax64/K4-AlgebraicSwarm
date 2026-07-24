// wasm/src/ledger/schema.ts

export type K4Type = 'P' | 'I' | 'U' | 'R' | 'P-U' | 'I-R' | 'P-R' | 'I-U' | 'P-I' | 'U-R'; 
export type ElementRole = 'SPEC' | 'MATERIAL' | 'NIL';

export interface World {
  id: string;               
  name: string;             
  description: string;
  apiProvider: 'manual' | 'auto' | 'openai' | 'anthropic' | 'custom'; 
  apiKey: string;           
  apiBaseUrl: string;      
  persistCorpus: boolean; 
  createdAt: number;
  updatedAt: number;
}

export interface Language {
  id: string;
  worldId: string;
  name: string;
  description?: string;
}

export interface Vocabulary {
  id: string;
  languageId: string;
  term: string;
  k4Type: K4Type;
  role: ElementRole;
  description: string;
}

export interface View {
  id: string;
  worldId: string;
  languageId: string;      
  name: string;
  description: string;
  
  // Innate baseline AC-coordinates
  innateOmega: number;
  innateR: number;
  innateL: number;
  innateC: number;
}

export interface Circuit {
  id: string;
  viewId: string;
  name: string;            
  activeFace: K4Type;
  heldAbsentVar: K4Type;
  omega: number;
  r: number;
  l: number;
  c: number;
  diagnosticVocab: string[];
  rewardQuestion: string;
}

export interface LedgerEntry {
  id: string;
  viewId: string;          // History belongs to the View/Session
  cycle: number;
  seq: number;
  stance: string;          
  health: string;
  snapshotJson: string;
  createdAt: number;
}

export interface CorpusDocEntry {
  id: string;
  worldId: string;
  name: string;
  content: string;
}
