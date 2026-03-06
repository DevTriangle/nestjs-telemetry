import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { TelemetryConfig as TelemetryConfig } from "./types/config";
import {
  ATTR_SERVICE_NAME,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from "@opentelemetry/semantic-conventions";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { NestInstrumentation } from "@opentelemetry/instrumentation-nestjs-core";
import {
  Attributes,
  Context,
  context,
  propagation,
  Span,
  trace,
  Tracer,
} from "@opentelemetry/api";
import { JaegerPropagator } from "@opentelemetry/propagator-jaeger";

@Injectable()
export class TelemetryService implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger(TelemetryService.name);
  private otelSDK: NodeSDK | null = null;
  private tracer: Tracer;
  private isInitialized = false;

  constructor(private readonly config: TelemetryConfig) {}

  onModuleInit() {
    this.initialize();
  }

  private initialize(): void {
    if (this.isInitialized) return;

    try {
      const resource = resourceFromAttributes({
        [ATTR_SERVICE_NAME]: this.getServiceName(),
        [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]:
          this.config.environment ?? "production",
      });

      const traceExporter = this.createExporter();
      const traceProcessor = new BatchSpanProcessor(traceExporter);
      const instrumentations = this.createInstrumentations();
      this.registerPropagators();

      this.otelSDK = new NodeSDK({
        resource,
        spanProcessor: traceProcessor,
        instrumentations,
      });

      this.otelSDK.start();

      this.tracer = trace.getTracer(this.getServiceName());

      this.isInitialized = true;
      this.logger.log("Telemetry successfully initialized!");
    } catch (error) {
      this.logger.error("Telemetry initialization error:", error);
    }
  }

  private createInstrumentations(): (
    | HttpInstrumentation
    | ExpressInstrumentation
    | NestInstrumentation
  )[] {
    return [
      new HttpInstrumentation({
        ignoreIncomingRequestHook: (request): boolean => {
          const ignorePaths = new Set(this.config.ignorePaths);
          return ignorePaths.has(request.url ?? "");
        },
      }),
      new ExpressInstrumentation(),
      new NestInstrumentation(),
    ];
  }

  private createExporter(): OTLPTraceExporter {
    return new OTLPTraceExporter({
      url: this.config.otlpTracesEndpoint,
    });
  }

  private registerPropagators() {
    propagation.setGlobalPropagator({
      inject: (context, carrier, options) => {
        new JaegerPropagator().inject(context, carrier, options);
      },
      extract: (context, carrier, options) => {
        return new JaegerPropagator().extract(context, carrier, options);
      },
      fields: () => new JaegerPropagator().fields(),
    });
  }

  /** Get the tracer. */
  getTracer(): Tracer {
    if (!this.isInitialized) {
      throw new Error("Telemetry not initialized!");
    }

    return this.tracer;
  }

  /** Get the telemetry service name. */
  getServiceName(): string {
    return this.config.serviceName ?? "telemetry-service";
  }

  /** Start the new span.
   * @param name span name
   * @param options span options
   * @param activeContext active context
   */
  startSpan(
    name: string,
    options?: { attributes?: Attributes },
    activeContext?: Context,
  ): Span {
    const tracer = this.getTracer();

    const attributes = {
      ...this.config.defaultAttributes,
      ...options?.attributes,
    };

    return tracer.startSpan(
      name,
      {
        attributes,
      },
      activeContext,
    );
  }

  /** Get current active span from. */
  getSpan(): Span | undefined {
    return trace.getSpan(context.active());
  }

  /** Extract context from carrier (e.g. headers). */
  extractContext(carrier: any): Context | undefined {
    return propagation.extract(context.active(), carrier);
  }

  onModuleDestroy() {
    if (this.otelSDK) {
      this.otelSDK.shutdown().then(
        () => this.logger.log("OtelSDK shut down successfully"),
        (err) => this.logger.error("OtelSDK shut down error: ", err),
      );
    }
  }
}
