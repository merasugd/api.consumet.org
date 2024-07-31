import { anilistAdvancedQuery, anilistSearchQuery } from './queries';
import { MediaStatus } from './mediaStatus'

let api = 'https://graphql.anilist.co';

export const search = function(vars: any): Promise<any> {
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
            if(res === null) return resolveError(500, "BAD REQUEST! NOT OK", resolve);

            let data = res.data;
            if(!data) return resolveError(500, "DID NOT RECEIVE ANY DATA.", resolve);
            
            let page = data.Page;
            if(!page) return resolveError(404, "DID NOT RECEIVE ANY PAGE DATA.", resolve);
            
            let info = page.pageInfo;
            let results = page.media;

            if(!info || !results || typeof info !== "object" || !Array.isArray(results)) return resolveError(404, "EMPTY RESULTS ARE RECEIVED", resolve);;
            
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
            return resolveError(500, `INTERNAL ERROR: ${e}`, resolve);;
        });
    });
};

function handleResponse(response: any) {
    return response.json().then(function (json: any) {
        return response.ok ? json : null;
    });
};

function resolveError(status: number, msg: string, resolve: any) {
    return resolve({
        status,
        data: {
            error: "[AnilistError]: "+msg
        }
    })
}