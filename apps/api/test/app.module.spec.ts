import { Test } from '@nestjs/testing'; import { AppModule } from '../src/app.module';
describe('Phase 0 module graph',()=>{it('compiles without circular-dependency errors',async()=>{const ref=await Test.createTestingModule({imports:[AppModule]}).compile();expect(ref).toBeDefined();await ref.close();},30000);});
