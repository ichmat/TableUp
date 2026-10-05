using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TUROAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddPlacementSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Les restaurants existants reçoivent les mêmes valeurs qu'un restaurant neuf (initialiseurs de Restaurant)
            migrationBuilder.AddColumn<int>(
                name: "BookingHorizonDays",
                table: "Restaurants",
                type: "integer",
                nullable: false,
                defaultValue: 60);

            migrationBuilder.AddColumn<int>(
                name: "MinBookingNoticeMinutes",
                table: "Restaurants",
                type: "integer",
                nullable: false,
                defaultValue: 60);

            migrationBuilder.AddColumn<bool>(
                name: "SuggestCombinations",
                table: "Restaurants",
                type: "boolean",
                nullable: false,
                defaultValue: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BookingHorizonDays",
                table: "Restaurants");

            migrationBuilder.DropColumn(
                name: "MinBookingNoticeMinutes",
                table: "Restaurants");

            migrationBuilder.DropColumn(
                name: "SuggestCombinations",
                table: "Restaurants");
        }
    }
}
