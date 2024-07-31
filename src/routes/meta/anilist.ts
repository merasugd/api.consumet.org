import { Redis } from 'ioredis';
import { FastifyRequest, FastifyReply, FastifyInstance, RegisterOptions } from 'fastify';
import { ANIME, META, PROVIDERS_LIST } from '@consumet/extensions';
import { Genres } from '@consumet/extensions/dist/models';
import Anilist from '@consumet/extensions/dist/providers/meta/anilist';
import { StreamingServers } from '@consumet/extensions/dist/models';

import cache from '../../utils/cache';
import { redis } from '../../main';
import NineAnime from '@consumet/extensions/dist/providers/anime/9anime';
import Gogoanime from '@consumet/extensions/dist/providers/anime/gogoanime';

import { search as advSearch } from '../../extra/advanceSearch';

require('dotenv').config();

const nsfw_default = (process.env.NSFW && (process.env.NSFW.toLowerCase() === 'true' || process.env.NSFW.toLowerCase() === '1')) || undefined;

const routes = async (fastify: FastifyInstance, options: RegisterOptions) => {
  fastify.get('/', (_, rp) => {
    rp.status(200).send({
      intro:
        "Welcome to the anilist provider: check out the provider's website @ https://anilist.co/",
      routes: ['/:query', '/info/:id', '/watch/:episodeId'],
      documentation: 'https://docs.consumet.org/#tag/anilist',
    });
  });

  fastify.get('/:query', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = (request.params as { query: string }).query;

    const page = (request.query as { page: number }).page;
    const perPage = (request.query as { perPage: number }).perPage;

    const res = await advSearch({
      query,
      page,
      perPage,
      isAdult: nsfw_default
    });

    if(res.data && res.data.error) return reply.status(res.status).send(res.data);

    reply.status(200).send(res);
  });

  fastify.get(
    '/advanced-search',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = (request.query as { query: string }).query;
      const page = (request.query as { page: number }).page;
      const perPage = (request.query as { perPage: number }).perPage;
      const type = (request.query as { type: string }).type;
      let genres = (request.query as { genres: string | string[] }).genres;
      const id = (request.query as { id: string }).id;
      const format = (request.query as { format: string }).format;
      let sort = (request.query as { sort: string | string[] }).sort;
      const status = (request.query as { status: string }).status;
      const year = (request.query as { year: number }).year;
      const season = (request.query as { season: string }).season;
      let nsfw = (request.query as { nsfw: string | boolean }).nsfw;

      if (nsfw === 'true' || nsfw === '1') nsfw = true;
      else nsfw = nsfw_default || false;

      if (genres) {
        JSON.parse(genres as string).forEach((genre: string) => {
          if (!Object.values(Genres).includes(genre as Genres)) {
            return reply.status(400).send({ message: `${genre} is not a valid genre` });
          }
        });

        genres = JSON.parse(genres as string);
      }

      if (sort) sort = JSON.parse(sort as string);

      if (season)
        if (!['WINTER', 'SPRING', 'SUMMER', 'FALL'].includes(season))
          return reply.status(400).send({ message: `${season} is not a valid season` });

      const res = await advSearch({
        query,
        type,
        page,
        perPage,
        format,
        sort: sort as string[],
        genres: genres as string[],
        id,
        year,
        status,
        season,
        isAdult: nsfw
      })

      if(res.data && res.data.error) return reply.status(res.status).send(res.data);

      reply.status(200).send(res);
    },
  );

  fastify.get('/trending', async (request: FastifyRequest, reply: FastifyReply) => {
    const page = (request.query as { page: number }).page;
    const perPage = (request.query as { perPage: number }).perPage;

    const res = await advSearch({
      sort: ["TRENDING_DESC", "POPULARITY_DESC"],
      page,
      perPage,
      isAdult: nsfw_default,
    });

    if(res.data && res.data.error) return reply.status(res.status).send(res.data);

    redis
      ? reply
          .status(200)
          .send(
            await cache.fetch(
              redis as Redis,
              `anilist:trending;${page};${perPage}`,
              () => res,
              60 * 60,
            ),
          )
      : reply.status(200).send(res);
  });

  fastify.get('/popular', async (request: FastifyRequest, reply: FastifyReply) => {
    const page = (request.query as { page: number }).page;
    const perPage = (request.query as { perPage: number }).perPage;

    const res = await advSearch({
      sort: ["POPULARITY_DESC"],
      page,
      perPage,
      isAdult: nsfw_default,
    });

    if(res.data && res.data.error) return reply.status(res.status).send(res.data);

    redis
      ? reply
          .status(200)
          .send(
            await cache.fetch(
              redis as Redis,
              `anilist:popular;${page};${perPage}`,
              () => res,
              60 * 60,
            ),
          )
      : reply.status(200).send(res);
  });

  fastify.get(
    '/airing-schedule',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const page = (request.query as { page: number }).page;
      const perPage = (request.query as { perPage: number }).perPage;
      const weekStart = (request.query as { weekStart: number | string }).weekStart;
      const weekEnd = (request.query as { weekEnd: number | string }).weekEnd;
      const notYetAired = (request.query as { notYetAired: boolean }).notYetAired;

       const anilist = generateAnilistMeta();
      const _weekStart = Math.ceil(Date.now() / 1000);

      const res = await anilist.fetchAiringSchedule(
        page ?? 1,
        perPage ?? 20,
        weekStart ?? _weekStart,
        weekEnd ?? _weekStart + 604800,
        notYetAired ?? true,
      );

      reply.status(200).send(res);
    },
  );

  fastify.get('/genre', async (request: FastifyRequest, reply: FastifyReply) => {
    const genres = (request.query as { genres: string }).genres;
    const page = (request.query as { page: number }).page;
    const perPage = (request.query as { perPage: number }).perPage;

    if (typeof genres === 'undefined')
      return reply.status(400).send({ message: 'genres is required' });

    JSON.parse(genres).forEach((genre: string) => {
      if (!Object.values(Genres).includes(genre as Genres)) {
        return reply.status(400).send({ message: `${genre} is not a valid genre` });
      }
    });

    const res = await advSearch({
      genres: JSON.parse(genres),
      page,
      perPage,
      isAdult: nsfw_default
    });

    if(res.data && res.data.error) return reply.status(res.status).send(res.data);

    reply.status(200).send(res);
  });

  fastify.get(
    '/recent-episodes',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const provider = (request.query as { provider: 'gogoanime' | 'zoro' }).provider;
      const page = (request.query as { page: number }).page;
      const perPage = (request.query as { perPage: number }).perPage;

      const anilist = generateAnilistMeta(provider);

      const res = await anilist.fetchRecentEpisodes(provider, page, perPage);

      reply.status(200).send(res);
    },
  ),
    fastify.get('/random-anime', async (request: FastifyRequest, reply: FastifyReply) => {
      const anilist = generateAnilistMeta();
      
      async function get(page: number = 0, tries: number = 0): Promise<any> {
        let random_page = Math.floor(Math.random() * (50 - 1) + 1);

        if(tries > 50) return null

        const all = await advSearch({
          page: page !== 0 ? page : random_page,
          perPage: 500,
          isAdult: nsfw_default
        });

        if(all.data && all.data.error) return reply.status(all.status).send(all.data);
        
        if(all.results && Array.isArray(all.results) && all.results.length > 0) {
          let finally_got = all.results[Math.floor(Math.random()*all.results.length)];
          let id = finally_got.id;
          if(!id) return await get(page !== 0 ? page+1 : 1, tries+1);

          let returnData = Object.assign(finally_got, (await anilist.fetchAnilistInfoById(id)));
          return returnData;
        } else return await get(page !== 0 ? page+1 : 1, tries+1);
      };

      let got = await get();
      if(got === null) return reply.status(404).send({ error: "Anime not found" });

      reply.status(200).send(got);
    });

  fastify.get('/servers/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const id = (request.params as { id: string }).id;
    const provider = (request.query as { provider?: string }).provider;

    let anilist = generateAnilistMeta(provider);

    const res = await anilist.fetchEpisodeServers(id);

    anilist = new META.Anilist();
    reply.status(200).send(res);
  });

  fastify.get('/episodes/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const id = (request.params as { id: string }).id;
    const provider = (request.query as { provider?: string }).provider;
    let fetchFiller = (request.query as { fetchFiller?: string | boolean }).fetchFiller;
    let dub = (request.query as { dub?: string | boolean }).dub;
    const locale = (request.query as { locale?: string }).locale;

    let anilist = generateAnilistMeta(provider);

    if (dub === 'true' || dub === '1') dub = true;
    else dub = false;

    if (fetchFiller === 'true' || fetchFiller === '1') fetchFiller = true;
    else fetchFiller = false;

    try {
      let data = await anilist.fetchAnimeInfo(id, dub, fetchFiller as boolean);
      let raw = await anilist.fetchEpisodesListById(id, dub, fetchFiller as boolean);
      let eps = Array.isArray(raw) && raw.length === data.totalEpisodes || raw.length > 0 ? raw : data.episodes;

      let got = eps ? eps.map((ep, num) => {
        let anime_title = typeof data.title === 'object' ? data.title.english || data.title.romaji || data.title.native || data.title.userPreferred : String(data.title);
        let list_type = data.type?.toLocaleLowerCase() === 'movie' ? `Movie ${num+1}` : `Episode ${num+1}`;
        let default_title = anime_title+' '+list_type;
        let title = ep.title === `EP ${num+1}` ? default_title : ep.title;

        return {
          "id": ep.id,
          "title": title || default_title,
          "image": ep.image,
          "imageHash": ep.imageHash,
          "number": num+1,
          "createdAt": ep.releaseDate || data.releaseDate,
          "releaseDate": ep.releaseDate || data.releaseDate,
          "description": ep.description || data.description || 'MIRURO',
          "url": ep.url
        };
      }) : [];

      redis
        ? reply
            .status(200)
            .send(
              await cache.fetch(
                redis,
                `anilist:episodes;${id};${dub};${fetchFiller};${anilist.provider.name.toLowerCase()}`,
                () => got,
                dayOfWeek === 0 || dayOfWeek === 6 ? 60 * 120 : (60 * 60) / 2,
              ),
            )
        : reply
            .status(200)
            .send(got);
    } catch (err) {
      return reply.status(404).send({ message: 'Anime not found' });
    }
  });

  // anilist info without episodes
  fastify.get('/data/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const id = (request.params as { id: string }).id;

    const anilist = generateAnilistMeta();
    const res = await anilist.fetchAnilistInfoById(id);

    reply.status(200).send(res);
  });

  // anilist info with episodes
  fastify.get('/info/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const id = (request.params as { id: string }).id;
    const today = new Date();
    const dayOfWeek = today.getDay();
    const provider = (request.query as { provider?: string }).provider;
    let fetchFiller = (request.query as { fetchFiller?: string | boolean }).fetchFiller;
    let isDub = (request.query as { dub?: string | boolean }).dub;
    const locale = (request.query as { locale?: string }).locale;

    let anilist = generateAnilistMeta(provider);

    if (isDub === 'true' || isDub === '1') isDub = true;
    else isDub = false;

    if (fetchFiller === 'true' || fetchFiller === '1') fetchFiller = true;
    else fetchFiller = false;

    try {
      redis
        ? reply
            .status(200)
            .send(
              await cache.fetch(
                redis,
                `anilist:info;${id};${isDub};${fetchFiller};${anilist.provider.name.toLowerCase()}`,
                async () =>
                  anilist.fetchAnimeInfo(id, isDub as boolean, fetchFiller as boolean),
                dayOfWeek === 0 || dayOfWeek === 6 ? 60 * 120 : (60 * 60) / 2,
              ),
            )
        : reply
            .status(200)
            .send(
              await anilist.fetchAnimeInfo(id, isDub as boolean, fetchFiller as boolean),
            );
    } catch (err: any) {
      reply.status(500).send({ message: err.message });
    }
  });

  // anilist character info
  fastify.get('/character/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const id = (request.params as { id: string }).id;

    const anilist = generateAnilistMeta();
    const res = await anilist.fetchCharacterInfoById(id);

    reply.status(200).send(res);
  });

  fastify.get(
    '/watch/:episodeId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const episodeId = (request.params as { episodeId: string }).episodeId;
      const provider = (request.query as { provider?: string }).provider;
      const server = (request.query as { server?: StreamingServers }).server;

      if (server && !Object.values(StreamingServers).includes(server))
        return reply.status(400).send('Invalid server');

      let anilist = generateAnilistMeta(provider);

      try {
        redis
          ? reply
              .status(200)
              .send(
                await cache.fetch(
                  redis,
                  `anilist:watch;${episodeId};${anilist.provider.name.toLowerCase()};${server}`,
                  async () => anilist.fetchEpisodeSources(episodeId, server),
                  600,
                ),
              )
          : reply.status(200).send(await anilist.fetchEpisodeSources(episodeId, server));

        anilist = new META.Anilist(undefined, {
          url: process.env.PROXY as string | string[],
        });
      } catch (err) {
        reply
          .status(500)
          .send({ message: 'Something went wrong. Contact developer for help.' });
      }
    },
  );
};

const generateAnilistMeta = (provider: string | undefined = undefined): Anilist => {
  if (typeof provider !== 'undefined') {
    let possibleProvider = PROVIDERS_LIST.ANIME.find(
      (p) => p.name.toLowerCase() === provider.toLocaleLowerCase(),
    );

    if (possibleProvider instanceof NineAnime) {
      possibleProvider = new ANIME.NineAnime(
        process.env?.NINE_ANIME_HELPER_URL,
        {
          url: process.env?.NINE_ANIME_PROXY as string,
        },
        process.env?.NINE_ANIME_HELPER_KEY as string,
      );
    }

    return new META.Anilist(possibleProvider, {
      url: process.env.PROXY as string | string[],
    });
  } else {
    // default provider is gogoanime
    return new Anilist(new Gogoanime(), {
      url: process.env.PROXY as string | string[],
    });
  }
};

export default routes;
