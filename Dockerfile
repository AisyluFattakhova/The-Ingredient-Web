# Use the official Python base image
FROM python:3.9-slim

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements.txt into the container (will be created in the next step)
COPY requirements.txt .

# Install the dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your application into the container
COPY . .

# Expose the port the app will run on (default Flask port is 5000)
EXPOSE 5000

# Set the command to run your app (e.g., app.py) using Flask's development server
CMD ["python", "app.py"]
