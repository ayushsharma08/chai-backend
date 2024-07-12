import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'

const app = express()
//configure it after app banne ke bad that why we use app.use and all
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

app.use(express.json({ limit: "16kb" }))
app.use(express.urlencoded({ extended: true, limit: "16kb" }))
app.use(express.static("pubic"))
app.use(cookieParser())

//routes

import userRouer from "./routes/user.routes.js"


//routes declaration
// (for getting the router back we use middleware app.use not app.get)
app.use("/api/v1/users", userRouer)


export default app