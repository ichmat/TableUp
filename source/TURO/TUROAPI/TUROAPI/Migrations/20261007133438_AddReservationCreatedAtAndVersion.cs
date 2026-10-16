using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TUROAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddReservationCreatedAtAndVersion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Les réservations existantes datent de la migration ; ensuite, c'est l'API qui pose la date
            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Reservations",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "now()");
            migrationBuilder.Sql("ALTER TABLE \"Reservations\" ALTER COLUMN \"CreatedAt\" DROP DEFAULT;");

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                table: "Reservations",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "xmin",
                table: "Reservations");
        }
    }
}
