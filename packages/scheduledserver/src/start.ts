import { pipe } from '@xrengine/common/src/utils/pipe'
import { Application, ServerMode } from '@xrengine/server-core/declarations'
import config from '@xrengine/server-core/src/appconfig'
import {
  configureK8s,
  configureRedis,
  configureSocketIO,
  createFeathersExpressApp
} from '@xrengine/server-core/src/createApp'
import multiLogger from '@xrengine/server-core/src/ServerLogger'

const logger = multiLogger.child({ component: 'scheduledserver' })

process.on('unhandledRejection', (error, promise) => {
  logger.error(error, 'UNHANDLED REJECTION - Promise: %o', promise)
})

const scheduledServerPipe = pipe(configureSocketIO(), configureRedis(), configureK8s())

export const start = async (): Promise<Application> => {
  const app = createFeathersExpressApp(ServerMode.Scheduled, scheduledServerPipe)

  app.set('host', config.server.local ? config.server.hostname + ':' + config.server.port : config.server.hostname)
  app.set('port', config.server.port)

  //TODO: Perform scheduled job here
  //TODO: Check do we really need to run app.listen

  logger.info('Scheduled server running.')

  const port = config.scheduleserver.port || 5050

  await app.listen(port)

  logger.info('Started listening on ' + port)

  process.on('unhandledRejection', (error, promise) => {
    logger.error(error, 'UNHANDLED REJECTION - Promise: %o', promise)
  })

  return app
}
