import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { AdditionalAttributeData, TelemetryConfig as TelemetryConfig, TelemetryPropagators } from './types/config'
import { ATTR_SERVICE_NAME, SEMRESATTRS_DEPLOYMENT_ENVIRONMENT } from '@opentelemetry/semantic-conventions'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core'
import { Attributes, Context, context, propagation, Span, TextMapPropagator, trace, Tracer } from '@opentelemetry/api'
import { JaegerPropagator } from '@opentelemetry/propagator-jaeger'
import { CompositePropagator, W3CBaggagePropagator, W3CTraceContextPropagator } from '@opentelemetry/core'
import { B3InjectEncoding, B3Propagator } from '@opentelemetry/propagator-b3'

@Injectable()
export class TelemetryService implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger(TelemetryService.name)
  private otelSDK: NodeSDK | null = null
  private tracer: Tracer
  private isInitialized = false

  constructor(private readonly config: TelemetryConfig) {}

  onModuleInit() {
    this.initialize()
  }

  private initialize(): void {
    if (this.isInitialized) return

    try {
      const resource = resourceFromAttributes({
        [ATTR_SERVICE_NAME]: this.getServiceName(),
        [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: this.config.environment ?? 'production',
      })

      const traceExporter = this.createExporter()
      const traceProcessor = new BatchSpanProcessor(traceExporter)
      const instrumentations = this.createInstrumentations()
      this.registerPropagators()

      this.otelSDK = new NodeSDK({
        resource,
        spanProcessor: traceProcessor,
        instrumentations,
      })

      this.otelSDK.start()

      this.tracer = trace.getTracer(this.getServiceName())

      this.isInitialized = true
      this.logger.log('Telemetry successfully initialized!')
    } catch (error) {
      this.logger.error('Telemetry initialization error:', error)
    }
  }

  private createInstrumentations(): (HttpInstrumentation | ExpressInstrumentation | NestInstrumentation)[] {
    return [
      new HttpInstrumentation({
        ignoreIncomingRequestHook: (request): boolean => {
          const ignorePaths = new Set(this.config.ignorePaths)
          return ignorePaths.has(request.url ?? '')
        },
      }),
      new ExpressInstrumentation(),
      new NestInstrumentation(),
    ]
  }

  private createExporter(): OTLPTraceExporter {
    return new OTLPTraceExporter({
      url: this.config.otlpTracesEndpoint,
    })
  }

  private registerPropagators() {
    const cProps = this.config.propagators ?? [TelemetryPropagators.W3C_TRACE_CONTEXT]

    const propagators: TextMapPropagator[] = []

    if (cProps.includes(TelemetryPropagators.JAEGER)) propagators.push(new JaegerPropagator())

    if (cProps.includes(TelemetryPropagators.W3C_TRACE_CONTEXT)) propagators.push(new W3CTraceContextPropagator())

    if (cProps.includes(TelemetryPropagators.W3C_BAGGAGE)) propagators.push(new W3CBaggagePropagator())

    if (cProps.includes(TelemetryPropagators.B3_SINGLE_HEADER)) {
      propagators.push(new B3Propagator({ injectEncoding: B3InjectEncoding.SINGLE_HEADER }))
    }

    if (cProps.includes(TelemetryPropagators.B3_MULTI_HEADER)) {
      propagators.push(new B3Propagator({ injectEncoding: B3InjectEncoding.MULTI_HEADER }))
    }

    const propagator = new CompositePropagator({
      propagators: propagators,
    })

    propagation.setGlobalPropagator(propagator)
  }

  /** Get the tracer. */
  getTracer(): Tracer {
    if (!this.isInitialized) {
      throw new Error('Telemetry not initialized!')
    }

    return this.tracer
  }

  /** Get the telemetry service name. */
  getServiceName(): string {
    return this.config.serviceName ?? 'telemetry-service'
  }

  /** Get the telemetry service name. */
  getAdditionalAttributesData(): AdditionalAttributeData[] {
    return this.config.additionalAttributes ?? []
  }

  /** Get the config. */
  getConfig(): TelemetryConfig {
    return this.config
  }

  /** Start the new span.
   * @param name span name
   * @param options span options
   * @param activeContext active context
   */
  startSpan(name: string, options?: { attributes?: Attributes }, activeContext?: Context): Span {
    const tracer = this.getTracer()

    const attributes = {
      ...this.config.defaultAttributes,
      ...options?.attributes,
    }

    return tracer.startSpan(
      name,
      {
        attributes,
      },
      activeContext,
    )
  }

  /** Get current active span from. */
  getSpan(): Span | undefined {
    return trace.getSpan(context.active())
  }

  /** Extract context from carrier (e.g. headers). */
  extractContext(carrier: any): Context {
    return propagation.extract(context.active(), carrier)
  }

  onModuleDestroy() {
    if (this.otelSDK) {
      this.otelSDK.shutdown().then(
        () => {
          this.logger.log('OtelSDK shut down successfully')
        },
        (err: unknown) => {
          this.logger.error('OtelSDK shut down error: ', err)
        },
      )
    }
  }
}
