import { DynamicModule, Global, Module, Provider } from '@nestjs/common'
import { TelemetryConfig } from './types/config'
import { TelemetryService } from './telemetry.service'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { TracingInterceptor } from './interceptors/telemetry.interceptor'

@Global()
@Module({})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class TelemetryModule {
  static forRoot(config: TelemetryConfig): DynamicModule {
    const configProvider: Provider = {
      provide: 'TELEMETRY_CONFIG',
      useValue: config,
    }

    const providers = this.getProviders()

    return {
      module: TelemetryModule,
      providers: [configProvider, ...providers],
      exports: [TelemetryService],
    }
  }

  static forRootAsync(config: {
    useFactory: (...args: any[]) => Promise<TelemetryConfig> | TelemetryConfig
    inject?: any[]
    imports?: any[]
  }): DynamicModule {
    const configProvider: Provider = {
      provide: 'TELEMETRY_CONFIG',
      useFactory: config.useFactory,
      inject: config.inject ?? [],
    }

    const providers = this.getProviders()

    return {
      module: TelemetryModule,
      imports: config.imports ?? [],
      providers: [configProvider, ...providers],
      exports: [TelemetryService],
    }
  }

  private static getProviders(): Provider[] {
    const serviceProvider: Provider = {
      provide: TelemetryService,
      useFactory: (config: TelemetryConfig) => new TelemetryService(config),
      inject: ['TELEMETRY_CONFIG'],
    }

    const interceptorProvider: Provider = {
      provide: APP_INTERCEPTOR,
      useClass: TracingInterceptor,
    }

    return [serviceProvider, interceptorProvider]
  }
}
