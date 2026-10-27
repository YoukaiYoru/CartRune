package main

import (
	"log"

	"github.com/YoukaiYoru/api/internal/config"
	"github.com/YoukaiYoru/api/pkg/database"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()
	cfg := config.Load()
	db := database.Connect(cfg)
	if err := database.Migrate(db); err != nil {
		log.Fatalf("database migration failed: %v", err)
	}
	log.Println("database migration completed")
}
