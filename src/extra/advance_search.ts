import { anilistAdvancedQuery, anilistSearchQuery } from './queries';
import { MediaStatus } from './MediaStatus'

let api = 'https://graphql.anilist.co';

export const search = function(vars: any) {
    return new Promise(async(resolve, reject) => {
        vars.page = vars.page ? parseInt(String(vars.page)) : 1
        vars.perPage = vars.perPage ? parseInt(String(vars.perPage)) : 20
        vars.seasonYear = vars.year ? parseInt(String(vars.year)) : (new Date()).getFullYear()

        if(vars.year) delete vars.year

        let querytoUse = vars.query ? anilistSearchQuery(vars.query, vars.page, vars.perPage, vars.type || 'ANIME') : anilistAdvancedQuery()

        fetch(api, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                query: querytoUse,
                variables: vars
            })
        })
        .then(handleResponse)
        .then(res => {
            let data = res.data;
            if(!data) return reject(new Error('BAD'));
            
            let page = data.Page;
            if(!page) return reject(new Error('404'));
            
            let info = page.pageInfo;
            let results = page.media;

            if(!info || !results || typeof info !== "object" || !Array.isArray(results)) return reject(new Error('500'));
            
            const returnData = {
                currentPage: data?.Page?.pageInfo?.currentPage ?? data.meta?.currentPage,
                hasNextPage: data?.Page?.pageInfo?.hasNextPage ?? data.meta?.currentPage != data.meta?.lastPage,
                totalPages: data?.Page?.pageInfo?.lastPage,
                totalResults: data?.Page?.pageInfo?.total,
                results: [],
            };

            let all = data.Page.media.map((v: any) => {
                if(v.anilistId) {
                    return {
                        id: v.anilistId.toString(),
                        malId: v.mappings!['mal']!,
                        title: v.title,
                        status:
                        v.status == 'RELEASING'
                            ? MediaStatus.ONGOING
                            : v.status == 'FINISHED'
                            ? MediaStatus.COMPLETED
                            : v.status == 'NOT_YET_RELEASED'
                            ? MediaStatus.NOT_YET_AIRED
                            : v.status == 'CANCELLED'
                            ? MediaStatus.CANCELLED
                            : v.status == 'HIATUS'
                            ? MediaStatus.HIATUS
                            : MediaStatus.UNKNOWN,
                        image: v.coverImage ?? v.bannerImage,
                        imageHash: "hash",
                        cover: v.bannerImage,
                        coverHash: "hash",
                        popularity: v.popularity,
                        description: v.description,
                        rating: v.averageScore,
                        genres: v.genre,
                        color: v.color,
                        totalEpisodes: v.currentEpisode,
                        currentEpisodeCount: v?.nextAiringEpisode
                          ? v?.nextAiringEpisode?.episode - 1
                          : v.currentEpisode,
                        type: v.format,
                        releaseDate: v.year,
                    }
                }

                return {
                    id: String(v.id),
                    malId: v.idMal,
                    title: v.title,
                    status: v.status == 'RELEASING'
                    ? MediaStatus.ONGOING
                    : v.status == 'FINISHED'
                    ? MediaStatus.COMPLETED
                    : v.status == 'NOT_YET_RELEASED'
                    ? MediaStatus.NOT_YET_AIRED
                    : v.status == 'CANCELLED'
                    ? MediaStatus.CANCELLED
                    : v.status == 'HIATUS'
                    ? MediaStatus.HIATUS
                    : MediaStatus.UNKNOWN,
                    image: v.coverImage.extraLarge ?? v.coverImage.large ?? v.coverImage.medium,
                    imageHash: 'hash',
                    cover: v.bannerImage,
                    coverHash: 'hash',
                    popularity: v.popularity,
                    totalEpisodes: v.episodes ?? v.nextAiringEpisode?.episode - 1,
                    currentEpisode: v.nextAiringEpisode?.episode - 1 ?? v.episodes,
                    countryOfOrigin: v.countryOfOrigin,
                    description: v.description,
                    genres: v.genres,
                    rating: v.averageScore,
                    color: v.coverImage?.color,
                    type: v.format,
                    releaseDate: v.seasonYear,
                }
            });

            returnData.results = all;

            return resolve(returnData)
        })
        .catch(e => {
            return reject(e);
        });
    });
};

function handleResponse(response: any) {
    return response.json().then(function (json: any) {
        return response.ok ? json : Promise.reject(json);
    });
};