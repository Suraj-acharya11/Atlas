import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';

@Injectable()
export class PrivacyService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    const id = new Types.ObjectId(userId);
    const find = (collection: string) => this.connection.collection(collection).find({ userId: id }).toArray();
    const [goals, projects, tasks, knowledge, events, missions, weeklyPlans] = await Promise.all([
      find('goals'), find('projects'), find('tasks'), find('knowledge_relationships'), find('events'), find('missions'), find('weekly_plans'),
    ]);
    return { goals, projects, tasks, knowledge, events, plans: { missions, weeklyPlans } };
  }
}
