FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY docker-maven-settings.xml /root/.m2/settings.xml
COPY pom.xml ./
COPY src ./src
RUN --mount=type=cache,target=/root/.m2/repository mvn -B package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/target/expense-tracker.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
