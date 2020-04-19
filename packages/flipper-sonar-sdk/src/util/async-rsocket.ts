import { ReactiveSocket } from 'rsocket-types'
import { Single } from 'rsocket-flowable'

export async function asyncRequestResponse(
  socket: ReactiveSocket<string, string>,
  data: string
) {
  const single = socket.requestResponse({
    data,
    metadata: null
  })

  const payload = await asyncSubscribe(single)
  return payload
}

export async function asyncSubscribe<T>(single: Single<T>) {
  return new Promise<T>((resolve, reject) => {
    single.subscribe({
      onSubscribe: _ => {
        /** noop */
      },
      onComplete: complete => {
        resolve(complete)
      },
      onError: error => {
        console.error(error)
        reject(error)
      }
    })
  })
}
