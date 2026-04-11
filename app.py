import uvicorn
from fastapi import FastAPI, Depends, HTTPException, Request, Response
from starlette.templating import Jinja2Templates

app = FastAPI()
templates = Jinja2Templates(directory="templates")

@app.get("/")
async def root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

if __name__ == "__main__":
    uvicorn.run('app:app', host="0.0.0.0", port=8000)