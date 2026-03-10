import { CallHandler, ExecutionContext, HttpStatus, Inject, Injectable, NestInterceptor } from '@nestjs/common'
import { TelemetryService } from '../telemetry.service'
import { Observable, tap } from 'rxjs'
import { Attributes, context, propagation, SpanStatusCode, trace } from '@opentelemetry/api'
import { getNested } from '../../utils/get-nested'
import { TelemetryConfig } from '../types/config'

@Injectable()
export class TracingInterceptor implements NestInterceptor {
  constructor(
    @Inject(TelemetryService)
    private readonly telemetryService: TelemetryService,
  ) {}

  intercept(executionContext: ExecutionContext, next: CallHandler): Observable<any> {
    const req = this.getRequest(executionContext)
    const res = this.getResponse(executionContext)

    const extractedContext = this.telemetryService.extractContext(req.headers)
    const config = this.telemetryService.getConfig()

    const spanName = `${req.method as string}:${req.url as string}`
    const additionalAttributes = this.extractAdditionalAttributes(req, config)

    const span = this.telemetryService.startSpan(
      spanName,
      {
        attributes: {
          'http.method': req.method,
          'http.url': req.url,
          ...additionalAttributes,
        },
      },
      extractedContext,
    )

    const ctx = trace.setSpan(context.active(), span)

    if (res) {
      const carrier = {}
      propagation.inject(ctx, carrier)
      Object.entries(carrier).forEach(([key, value]) => {
        res.setHeader(key, value)
      })
    }

    return next.handle().pipe(
      tap({
        next: () => {
          span.setStatus({ code: SpanStatusCode.OK })
          if (res?.statusCode) span.setAttribute('http.status_code', res.statusCode)
          if (config.saveBodyOnSuccess) span.setAttribute('http.request.body', this.getBody(req))

          span.end()
        },
        error: (error) => {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
          })
          span.setAttribute('http.status_code', error.status ?? HttpStatus.INTERNAL_SERVER_ERROR)

          if (config.saveBodyOnError) span.setAttribute('http.request.body', this.getBody(req))

          span.recordException(error)
          span.end()
        },
      }),
    )
  }

  private getBody(request: any): string {
    try {
      const body = request.body

      if (body === undefined || body === null) return ''

      if (typeof body === 'object') {
        return JSON.stringify(body)
      } else {
        return String(body)
      }
    } catch {
      return 'BODY ERROR'
    }
  }

  private extractAdditionalAttributes(request: any, config: TelemetryConfig): Attributes {
    const attributes: Attributes = {}
    for (const attribute of config.additionalAttributes ?? []) {
      const keys = attribute.path.split('.')
      const value = getNested(request, keys)

      attributes[attribute.name] = value
    }

    return attributes
  }

  private getRequest(context: ExecutionContext) {
    if (context.getType() === 'http') return context.switchToHttp().getRequest()
    return context.switchToRpc().getContext()
  }

  private getResponse(context: ExecutionContext) {
    if (context.getType() === 'http') return context.switchToHttp().getResponse()
    return undefined
  }
}
