import { DynamicModule, Module } from '@nestjs/common';

export function Cron(): MethodDecorator {
  return () => undefined;
}

@Module({})
export class ScheduleModule {
  static forRoot(): DynamicModule { return { module: ScheduleModule }; }
}

