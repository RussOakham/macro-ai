import express from "express";

const app = express()
const port: number = 3030

app.get('/api/health', (req, res) => {
    res.send('OK')
})

app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})
