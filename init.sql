CREATE DATABASE IF NOT EXISTS finalexam_db;
USE finalexam_db;

DROP TABLE IF EXISTS `Users`;
CREATE TABLE `Users` (
  `UserID` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(100) NOT NULL,
  `Email` varchar(100) NOT NULL,
  `Password` varchar(255) NOT NULL,
  `PhoneNumber` varchar(50) DEFAULT NULL,
  `Address` varchar(255) DEFAULT NULL,
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`UserID`),
  UNIQUE KEY `Email` (`Email`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

LOCK TABLES `Users` WRITE;
-- INSERT INTO `Users` VALUES (1,'大通營造 (測試)','test@contractor.com','123456','0912-345-678','台北市信義區信義路五段','2025-11-19 12:36:52'),(2,'及時雨工程','user@buildlink.com','123456','0987-654-321','新北市板橋區','2025-11-19 12:36:52'),(3,'具根營造','big@gmail.com','123','092222222','新北市中和區','2025-11-19 15:41:16');
UNLOCK TABLES;
