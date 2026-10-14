using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TUROAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddCombinationSchedule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "KeepGluedFor",
                table: "Combinations",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SeparateAfterNoShowOf",
                table: "Combinations",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SnoozedUntil",
                table: "Combinations",
                type: "timestamp with time zone",
                nullable: true);

            // Rien n'écrivait ces dates jusqu'ici ; une base ancienne passe la contrainte quoi qu'il arrive
            migrationBuilder.Sql("UPDATE \"Combinations\" SET \"ActivateAt\" = NULL WHERE \"IsActive\";");
            migrationBuilder.Sql("UPDATE \"Combinations\" SET \"DeactivateAt\" = NULL WHERE NOT \"IsActive\";");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Combinations_OnePendingAction",
                table: "Combinations",
                sql: "(\"IsActive\" AND \"ActivateAt\" IS NULL) OR (NOT \"IsActive\" AND \"DeactivateAt\" IS NULL AND \"SeparateAfterNoShowOf\" IS NULL AND \"KeepGluedFor\" IS NULL)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Combinations_OnePendingAction",
                table: "Combinations");

            migrationBuilder.DropColumn(
                name: "KeepGluedFor",
                table: "Combinations");

            migrationBuilder.DropColumn(
                name: "SeparateAfterNoShowOf",
                table: "Combinations");

            migrationBuilder.DropColumn(
                name: "SnoozedUntil",
                table: "Combinations");
        }
    }
}
