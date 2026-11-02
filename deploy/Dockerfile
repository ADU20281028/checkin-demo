# 后端镜像：多阶段构建，供 Render / Railway / Fly.io 等平台使用
# 构建上下文请设为仓库根目录，例如 Render 里 Dockerfile Path 填 deploy/Dockerfile

FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY backend/pom.xml ./pom.xml
COPY backend/src ./src
RUN mvn -q -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /src/target/wechat-checkin-1.0.0.jar app.jar
ENV SPRING_PROFILES_ACTIVE=win
EXPOSE 8080
# 平台会通过 PORT 环境变量指定端口，H2 数据文件放在容器内 data/（重启即重置）
CMD ["sh", "-c", "java -jar app.jar --spring.profiles.active=win --server.port=${PORT:-8080}"]
