# Node.js application Dockerfile
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install && npm install -g nodemon

# Copy application source
COPY . .

# ★★★ 移除下面這行，因為已經沒有 config.docker.js 了 ★★★
# COPY config.docker.js config.js

# Expose port 80
EXPOSE 80

# Start the application
CMD ["nodemon", "app.js"]