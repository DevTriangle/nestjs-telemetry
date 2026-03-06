import { CallHandler, ExecutionContext, HttpStatus, Inject, Injectable, NestInterceptor } from '@nestjs/common'
import { TelemetryService } from '../telemetry.service'
import { Observable, tap } from 'rxjs'
import { context, propagation, SpanStatusCode, trace } from '@opentelemetry/api'

@Injectable()
export class TracingInterceptor implements NestInterceptor {
  constructor(@Inject(TelemetryService) private readonly telemetryService: TelemetryService) {}

  intercept(executionContext: ExecutionContext, next: CallHandler): Observable<any> {
    const req = this.getRequest(executionContext)
    const res = this.getResponse(executionContext)
    const handler = executionContext.getHandler()
    const controller = executionContext.getClass()

    const extractedContext = this.telemetryService.extractContext(req.headers)

    const spanName = `${req.method}:${req.url}`

    const span = this.telemetryService.startSpan(
      spanName,
      {
        attributes: {
          'http.method': req.method,
          'http.url': req.url,
          'http.route': req.url,
          controller: controller.name,
          handler: handler.name,
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

          span.end()
        },
        error: (error) => {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
          })
          span.setAttribute('http.status_code', error.status ?? HttpStatus.INTERNAL_SERVER_ERROR)
          span.recordException(error)
          span.end()
        },
      }),
    )
  }

  private getRequest(context: ExecutionContext) {
    if (context.getType() === 'http') return context.switchToHttp().getRequest()
    return context.switchToRpc().getContext()
  }

  private getResponse(context: ExecutionContext) {
    if (context.getType() === 'http') return context.switchToHttp().getResponse()
    return null
  }
}
