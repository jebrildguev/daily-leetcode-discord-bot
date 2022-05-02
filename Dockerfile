# syntax=docker/dockerfile:1
FROM node:17.8.0

# default path for all docker commands
WORKDIR /app

## copy package.json & package-lock.json into working directory /app
COPY ["package.json", "package-lock.json*", "./"]

## Execute a command to install Node modules into the command. 
RUN npm install

## Copy source code into the image
COPY . .

## Expose port 3000 for container to listen to 
EXPOSE 3000

## Launch the built image
CMD ["node", "app.js"]