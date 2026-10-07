using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TUROAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddFloorPlanDraft : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FloorPlanDrafts",
                columns: table => new
                {
                    RestaurantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Content = table.Column<string>(type: "jsonb", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FloorPlanDrafts", x => x.RestaurantId);
                    table.ForeignKey(
                        name: "FK_FloorPlanDrafts_Restaurants_RestaurantId",
                        column: x => x.RestaurantId,
                        principalTable: "Restaurants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_FloorPlanDrafts_UserStaffs_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "UserStaffs",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_FloorPlanDrafts_UpdatedById",
                table: "FloorPlanDrafts",
                column: "UpdatedById");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FloorPlanDrafts");
        }
    }
}
