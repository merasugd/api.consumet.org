import { FastifyRequest, FastifyReply, FastifyInstance, RegisterOptions } from 'fastify';

import proxy from './proxy';

const routes = async (fastify: FastifyInstance, options: RegisterOptions) => {
  await fastify.register(proxy, { prefix: '/proxy' });

  fastify.get('/', async (request: any, reply: any) => {
    reply.status(200).send('CORS (built-in).');
  });
};

export default routes;
