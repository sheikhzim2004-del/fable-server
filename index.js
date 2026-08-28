require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
app.use(cors({
    origin: [
        "http://localhost:3000",
        "https://fable-hazel.vercel.app"
    ],
    credentials: true
}));
app.use(express.json())


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.SERVER_PORT;
const MONGODB_URI = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(MONGODB_URI, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
async function run() {
    try {
        await client.connect();

        // Connect to the "fable_db" database and access its "books" collection
        const database = client.db("fable_db");
        const booksCollection = database.collection("books");
        const paymentCollection = database.collection("payment");
        const usersCollection = database.collection("user");

        app.post('/api/books', async (req, res) => {
            const book = req.body;
            const result = await booksCollection.insertOne(book);
            res.send(result)
        })
        app.post('/payment', async (req, res) => {
            const { price, userId, bookId, title, session_id, writer, coverImage, genre } = req.body;

            const isExistSession = await paymentCollection.findOne({ session_id })
            if (isExistSession) {
                return res.status(400).send({ message: "Session already exist" })
            }

            const pay_result = await paymentCollection.insertOne({
                userId,
                session_id,
                price: Number(price),
                title,
                bookId,
                writer: writer || "Unknown Writer",
                coverImage,
                genre,
                purchaseDate: new Date(),
                status: "Paid"
            })
            res.send(pay_result)
        })
        app.get('/api/books', async (req, res) => {
            try {
                const { writerId, status, page, limit } = req.query;

                // query object toiri kora (writerId ebong status filter korar jonno)
                let query = {};
                if (writerId) query.writerId = writerId;
                if (status) query.status = status; // browse page theke 'published' pathale shudhu published boi ashbe

                // jodi frontend theke page ba limit pathano hoy tahole pagination hobe
                if (page || limit) {
                    const pageNum = parseInt(page) || 1;
                    const limitNum = parseInt(limit) || 8; // proti page e 8 ta kore boi thakbe
                    const skip = (pageNum - 1) * limitNum;

                    // query onushare total koyta boi ache sheta count kora
                    const totalBooks = await booksCollection.countDocuments(query);

                    // specific page er boi gula database theke fetch kora
                    const books = await booksCollection
                        .find(query)
                        .skip(skip)
                        .limit(limitNum)
                        .toArray();

                    return res.send({
                        books,
                        totalBooks,
                        totalPages: Math.ceil(totalBooks / limitNum),
                        currentPage: pageNum,
                    });
                }

                // jodi pagination parameters na thake tahole shob boi ekbare pathabe
                const books = await booksCollection.find(query).toArray();
                res.send(books);

            } catch (error) {
                res.status(500).send({ message: "Failed to fetch books", error: error.message });
            }
        });
        // check: nirdisto user nirdisto book kinche ki na
        app.get('/payment/check', async (req, res) => {
            const { userId, bookId } = req.query;

            if (!userId || !bookId) {
                return res.status(400).send({ message: "userId and bookId are required" });
            }

            const payment = await paymentCollection.findOne({
                userId: String(userId),
                bookId: String(bookId),
            });

            res.send({ isPurchased: !!payment }); // payment record thakle true pathabe !! ata diye payment kea boleean kora hoiche
        });

        //all users get 
        app.get('/users', async (req, res) => {
            const users = await usersCollection.find().toArray();
            res.send(users)
        })

        app.get("/payment/user/:userId", async (req, res) => {
            const { userId } = req.params;
            const result = await paymentCollection.find({ userId: String(userId) }).toArray();
            res.send(result)
        })
        app.get("/api/top-writers", async (req, res) => {
            try {
                // Jodi sales tracking collection thake athoba user/writers theke sort kore
                const topWriters = await usersCollection
                    .find({ role: "writer" })
                    .sort({ totalSales: -1 }) // Beshi bikri onushare sort
                    .limit(3)
                    .toArray();

                res.send(topWriters);
            } catch (error) {
                res.status(500).send({ message: "Failed to fetch top writers" });
            }
        });
        app.get('/api/books/:id', async (req, res) => {
            const id = req.params.id;

            const book = await booksCollection.findOne({
                _id: new ObjectId(id)
            });

            res.send(book);
        });
        app.get('/payments/writer/:writerId', async (req, res) => {
            try {
                const { writerId } = req.params;

                // writerId er shob book er _id gula ber kora
                const writerBooks = await booksCollection.find({ writerId }).toArray();
                const bookIds = writerBooks.map((book) => String(book._id));

                // shei bookId gula diye payment collection theke shob sale khoja
                const sales = await paymentCollection
                    .find({ bookId: { $in: bookIds } })
                    .sort({ _id: -1 })
                    .toArray();

                const totalSales = sales.reduce((sum, sale) => sum + Number(sale.price), 0);

                res.send({ sales, totalSales, count: sales.length });
            } catch (error) {
                res.status(500).send({ message: "Failed to fetch writer sales", error: error.message });
            }
        });
        // user er kena shob book er talika (User Dashboard- er jonno)
        app.get('/payments/user/:userId', async (req, res) => {
            const { userId } = req.params;
            const result = await paymentCollection.find({ userId: String(userId) }).toArray();
            res.send(result);
        });
        app.put('/api/books/:id', async (req, res) => {
            const id = req.params.id;
            const updatedBook = req.body;

            delete updatedBook._id; // _id kokhono update payload এ pathano thik na.

            const result = await booksCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: updatedBook }
            );
            res.send(result);
        });
        app.patch('/api/books/:id/status', async (req, res) => {
            try {
                const { id } = req.params;
                const { status } = req.body; // 'published' ba 'unpublished'

                const result = await booksCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status: status } }
                );

                res.send(result);
            } catch (error) {
                res.status(500).send({ message: "Failed to update book status", error: error.message });
            }
        });
        app.patch('/user/:id', async (req, res) => {
            try {
                const { id } = req.params;
                const { role } = req.body;

                const result = await usersCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { role: role } }
                )
                res.send(result)
            } catch (error) {
                res.status(500), send({ message: "Failed to update users role", error: error.message })
            }
        })

        app.delete('/api/books/:id', async (req, res) => {
            try {
                const id = req.params.id;

                const result = await booksCollection.deleteOne({
                    _id: new ObjectId(id)
                });

                if (result.deletedCount === 0) {
                    return res.status(404).send({
                        error: "Book not found"
                    });
                }

                res.send({
                    success: true,
                    message: "Book deleted successfully"
                });

            } catch (error) {
                console.error(error);

                res.status(500).send({
                    error: "Failed to delete book"
                });
            }
        });

        app.delete('/user/:id', async (req, res) => {
            try {
                const { id } = req.params;
                const result = await usersCollection.deleteOne({ _id: new ObjectId(id) })
                if (result.deletedCount === 0) {
                    return res.status(404).send({
                        error: "User Not Found"
                    })
                }
                res.send({
                    success: true,
                    message: "User Deleted Successfully"
                })
            } catch (error) {
                console.log(error);
                res.status(500).send({
                    error: "Failed to delete user"
                })
            }
        })




        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('the server site is working')
})



app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})