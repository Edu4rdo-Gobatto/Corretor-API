import 'reflect-metadata';
import { MediaModule } from './media.module';

describe('media module wiring', () => {
  it('registers the media controller', () => {
    const controllers = Reflect.getMetadata('controllers', MediaModule) as Array<new (...args: never[]) => unknown>;

    expect(controllers?.map((controller) => controller.name)).toContain('MediaController');
  });
});
