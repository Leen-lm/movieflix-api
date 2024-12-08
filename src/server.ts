import express from "express";
import { Prisma, PrismaClient } from "@prisma/client"
import swaggerUi from "swagger-ui-express"
import swaggerDocument from "../swagger.json"

const port = 3000;
const app = express();
const prisma = new PrismaClient();

app.use(express.json())
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument))


app.get("/movies", async (_, res) => {
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
        res.status(500).send( {message: "Houve um problema ao buscar os filmes!"})
    }
});

app.post("/movies", async (req, res) => {
    const { title, genre_id, language_id, oscar_count, release_date } = req.body;

    try{
        const movieWithSameTitle = await prisma.movie.findFirst({
            where: { title: {equals: title, mode: "insensitive"} }
        })

        if(movieWithSameTitle){
            return res.status(409).send({ message: "Já existe um filme cadastrado com esse título"})
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
        return res.status(500).send({message: "Falha ao cadastrar um filme"});
    }

    res.status(201).send();
});

app.put("/movies/:id", async (req, res) => {
    const id = Number(req.params.id);

    try{
        const movieId = await prisma.movie.findUnique({
            where: {
                id
            }
        });

        if (!movieId){
            return res.status(404).send({ message: "Filme não encontrado!" })
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
        return res.status(500).send({ message: "Falha ao atualizar informações do filme"})
    };   
});

app.delete("/movies/:id", async (req, res) => {
    const id = Number(req.params.id);

    try{     
        const movieId = await prisma.movie.findUnique({ where: { id } })

        if(!movieId) {
            return res.status(404).send({ message: "Filme não encontrado!" })
        };

        await prisma.movie.delete({ where: { id }});

        res.status(200).send();
    } catch(error) {
        return res.status(500).send({ message: "Não foi possível remover o filme!" })
    }
});

app.get("/movies/sort", async (req, res) => {
    const { sort } = req.query;

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
            return res.status(404).send({ message: "Nenhum filme encontrado." });
        }

        res.json(movies);
    } catch (error) {
        console.error("Erro ao buscar filmes:", error);
        res.status(500).send({ message: "Houve um problema ao buscar os filmes." });
    }
});
app.get("/movies/language", async (req, res) => {
    try {
        const { language } = req.query;

        if (!language) {
            return res.status(400).json({ message: "O parâmetro 'language' é obrigatório." });
        }

        const languageName = String(language).trim();

        const movies = await prisma.movie.findMany({
            where: {
                languages: {
                        name: {
                            equals: languageName,
                            mode: "insensitive", // Busca case-insensitive
                        },
                    },
                },
            include: {
                genres: true,
                languages: true,
            },
        });

        if (movies.length === 0) {
            return res.status(404).json({ message: `Nenhum filme encontrado para a linguagem: ${languageName}` });
        }

        res.json(movies);
    } catch (error) {
        console.error("Erro ao buscar filmes pela linguagem:", error);
        res.status(500).json({ message: "Erro ao buscar filmes pela linguagem!" });
    }
});

app.get("/movies/:genreName", async (req, res) => {
    const genreName = req.params.genreName

    try{
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
            return res.status(404).send({ message: "Gênero não encontrado!" })
        };
        
    } catch(error) {
        return res.status(500).send({ message: "Falha ao filtrar filmes pelo gênero!" })
    }
})



app.listen(port, () => {
    console.log(`Servidor em execução na porta: ${port}`)
})