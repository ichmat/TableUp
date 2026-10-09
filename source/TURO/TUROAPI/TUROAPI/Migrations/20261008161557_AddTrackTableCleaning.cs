using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TUROAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddTrackTableCleaning : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "TrackTableCleaning",
                table: "Restaurants",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TrackTableCleaning",
                table: "Restaurants");
        }
    }
}
