using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TUROAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddClientCreatedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Clients_RestaurantId",
                table: "Clients");

            // Les fiches existantes datent de la migration ; ensuite, c'est l'API qui pose la date
            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Clients",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "now()");
            migrationBuilder.Sql("ALTER TABLE \"Clients\" ALTER COLUMN \"CreatedAt\" DROP DEFAULT;");

            migrationBuilder.CreateIndex(
                name: "IX_Clients_RestaurantId_AnonymizedAt",
                table: "Clients",
                columns: new[] { "RestaurantId", "AnonymizedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Clients_RestaurantId_AnonymizedAt",
                table: "Clients");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Clients");

            migrationBuilder.CreateIndex(
                name: "IX_Clients_RestaurantId",
                table: "Clients",
                column: "RestaurantId");
        }
    }
}
