import {readFileSync} from 'node:fs';
import contract from './skeleton-contract.cjs';
const schema=JSON.parse(readFileSync(new URL('../src/domain/skeleton-schema.json',import.meta.url),'utf8'));
export const validateSkeleton=(input,sections)=>contract.validateSkeleton(input,sections,schema);
