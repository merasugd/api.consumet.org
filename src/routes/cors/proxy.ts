import { FastifyRequest, FastifyReply, FastifyInstance, RegisterOptions } from 'fastify';
import axios from 'axios';
import * as nodeUrl from 'url';

const routes = async (fastify: FastifyInstance, options: RegisterOptions) => {
    fastify.get('/', async(request: any, reply: FastifyReply) => {
        try {
            // Set CORS headers
            reply.header('Access-Control-Allow-Origin', '*'); // '*' allows all origins
            reply.header('Access-Control-Allow-Methods', 'GET, PUT, PATCH, POST, DELETE');
            reply.header('Access-Control-Allow-Headers', request.headers['access-control-request-headers']);

            // Extract the target URL from the query or headers
            const queryJson = request.query

            const targetURL = String(queryJson.url || 'google.com');
            if (!targetURL) {
                return reply.status(400).send({ error: 'Target-URL header or url query parameter is missing' });
            }

            let requestUrl = decodeURIComponent(targetURL);
            let corsRedirect = new nodeUrl.URL(requestUrl).href;

            // Make a GET request to the target URL
            const response = await axios.get(corsRedirect, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
                },
                timeout: 10000
            });

            // Forward the response from the target URL
            return reply.status(response.status).send(response.data);
        } catch (error: any) {
            if (error.response) {
                // The request was made and the server responded with a status code outside 2xx
                return reply.status(error.response.status).send(error.response.data);
            } else if (error.request) {
                // The request was made but no response was received
                return reply.status(500).send({ error: 'No response received from target URL' });
            } else {
                // An error occurred in setting up the request
                return reply.status(500).send({ error: 'Error in setting up the request' });
            }
        }
    })
}

export default routes;