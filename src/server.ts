import express, { Request, Response} from "express";
import { Prisma, PrismaClient } from "@prisma/client"
import swaggerUi from "swagger-ui-express"
import swaggerDocument from "../swagger.json"

const port = 3000;
const app = express();
const prisma = new PrismaClient();

const errorResponse = (res: Response, code: number, message: string, errors?: any) => res.status(code).json({ message, errors })


app.use(express.json())
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument))


app.get("/movies", async (req: Request, res: Response) => {
    try{
        const movies = await prisma.movie.findMany({
            orderBy: {
                title: "asc"
            },
            include: {
                genres: true,
                languages: true
            }
        });

        const totalMovies = movies.length
        let movieTotalDuration = 0;
        movies.forEach((movie) => {
            movieTotalDuration += movie.duration ?? 0
        })
        let averageDuration = totalMovies > 0 ? movieTotalDuration / totalMovies : 0;
        averageDuration = parseFloat(averageDuration.toFixed(2));

        res.json({
            totalMovies,
            averageDuration,
            movies
        });
    }catch (error) {
        console.error(error);
        return errorResponse(res, 500, "Houve um problema ao buscar os filmes!")
    }
});

app.post("/movies", async (req: Request, res: Response) => {
    const { title, genre_id, language_id, oscar_count, release_date } = req.body;

    try{
        const movieWithSameTitle = await prisma.movie.findFirst({
            where: { title: {equals: title, mode: "insensitive"} }
        })

        if(movieWithSameTitle){
            return errorResponse(res, 409, "Já existe um filme cadastradoo com esse título!");
        }

        await prisma.movie.create({
            data: {
                title,
                genre_id,
                language_id,
                oscar_count,
                release_date: new Date(release_date)
            }
        });
    } catch(error){
        return errorResponse(res, 500, "Falha ao cadastrar um filme!")
    }

    res.status(201).send();
});

app.put("/movies/:id", async (req: Request, res: Response) => {
    const id = Number(req.params.id);

    try{
        const movieId = await prisma.movie.findUnique({
            where: {
                id
            }
        });

        if (!movieId){
            return errorResponse(res, 404, "Filme não encontrado!");
        }

        const data = { ...req.body };
        data.release_date = data.release_date ? new Date(data.release_date) : undefined;

        const movie = await prisma.movie.update({
            where: {
                id
            },
            data: 
                data
        }); 
        
        res.status(200).send(movie);
    } catch(error){
        return errorResponse(res, 500, "Falha ao atualizar informações do filme!")
    };   
});

app.delete("/movies/:id", async (req: Request, res: Response) => {
    const id = Number(req.params.id);

    try{     
        const movieId = await prisma.movie.findUnique({ where: { id } })

        if(!movieId) {
            return errorResponse(res, 404, "Filme não encontrado!");
        };

        await prisma.movie.delete({ where: { id }});

        res.status(200).send();
    } catch(error) {
        return errorResponse(res, 500, "Não foi possível remover o filme!");
    }
});

app.get("/movies/sort", async (req: Request, res: Response) => {
    const { sort } = req.query;

    const validSortOptions = ['title', 'release_date', 'duration']
    if (sort && !validSortOptions.includes(sort as string)){
        return res.status(400).json({ message: "Parâmetro 'sort' inválido." })
    }

    let orderBy: Prisma.MovieOrderByWithRelationInput | undefined;
    if (sort === "title") {
        orderBy = { title: "asc" };
    } else if (sort === "release_date") {
        orderBy = { release_date: "desc" };
    } else if (sort === "duration") {
        orderBy = { duration: "asc"}
    } else {
        orderBy = undefined;
    }

    try {
        const movies = await prisma.movie.findMany({
            orderBy,
            include: {
                genres: true,
                languages: true,
            },
        });

        if (movies.length === 0) {
            return errorResponse(res, 404, "Nenhum filme encontrado!");
        }

        res.json(movies);
    } catch (error) {
        console.error("Erro ao buscar filmes:", error);
        return errorResponse(res, 500, "Houve um problema ao buscar os filmes!")
    }
});

app.get("/movies/filtered", async (req: Request, res: Response) => {
    try {
        const { sort, language } = req.query;

        const languageMap: Record<string, string> = {
            en: "Inglês",
            fr: "Francês",
            ptbr: "Português",
            jp: "Japonês",
            esp: "Espanhol"
        };
        
        if (!language || !languageMap[language]) {
            return res.status(400).json({ message: "O parâmetro 'language' é obrigatório ou inválido." });
        }

        const selectedLanguage = languageMap[language]

        const sortMap: Record<string, Prisma.MovieOrderByWithRelationInput> = {
            title: { title: "asc"},
            release_date: { release_date: "desc"},
            duration: { duration: "asc"},
        };

        const orderBy = sort ? sortMap[sort] : undefined;
        
            const movies = await prisma.movie.findMany({
                orderBy,
                where: {
                    languages: {
                        name: {
                            equals: selectedLanguage,
                            mode: "insensitive",
                        }
                    }
                },
                include: {
                    genres: true,
                    languages: true,
                },
            });

            if (movies.length === 0) {
                return errorResponse(res, 404, "Nenhum filme encontrado!");
            }

            res.json(movies);
        } catch (error) {
            console.error("Erro ao buscar filmes:", error);
            return errorResponse(res, 500, "Houve um problema ao buscar os filmes!")
        }
});

app.get("/movies/language/:language", async (req: Request, res: Response) => {
    try {
        const languageMap: Record<string, string> = {
            en: "Inglês",
            fr: "Francês",
            ptbr: "Português",
            jp: "Japonês",
            esp: "Espanhol"
        };
        
        const paramLanguage = req.params.language;

        const language = languageMap[paramLanguage];
        if (!language) {
            return res.status(400).json({ message: "O parâmetro 'language' é obrigatório ou inválido." });
        }

        const movies = await prisma.movie.findMany({
            where: {
                languages: {
                    name: {
                        equals: language,
                        mode: "insensitive"
                    }
                }
            },
            include: {
                genres: true,
                languages: true
            }
        });

        if (movies.length === 0) {
            return res.status(404).json({ message: `Nenhum filme encontrado para a linguagem: ${language}` });
        }

        res.json(movies);
    } catch (error) {
        console.error("Erro ao buscar filmes pela linguagem:", error);
        res.status(500).json({ message: "Erro ao buscar filmes pela linguagem!" });
    }
});

app.get("/movies/genres/:genreName", async (req: Request, res: Response) => {
    try{ 
        const genreName = req.params.genreName;

        const moviesFilteredByGenreName = await prisma.movie.findMany({
            include: {
                genres: true,
                languages: true
            },
            where: {
                genres: {
                    name: {
                        equals: genreName,
                        mode: "insensitive"
                    }
                }
            }
        });
        if(moviesFilteredByGenreName.length > 0){
            res.status(200).send(moviesFilteredByGenreName);
        } else {
            return errorResponse(res, 404, "Gênero não encontrado!");
        };
        
    } catch(error) {
        return errorResponse(res, 500, "Falha ao filtrar filmes pelo gênero!");
    }
})



app.listen(port, () => {
    console.log(`Servidor em execução na porta: ${port}`)
})