# DSEasy

**Making visualisation of DSE listed companies performance easy.**

DSEasy is a modern web dashboard designed to simplify the analysis of the Dar es Salaam Stock Exchange (DSE). It transforms raw market data into an interactive, user-friendly interface, allowing investors and analysts to track market performance at a glance.

## How It Works

DSEasy bridges the gap between static spreadsheet data and dynamic visualization:

### 1. Data Architecture

- **Backend**: The project leverages **Google Sheets** as a flexible, cloud-based database to store daily market summaries.
- **API Layer**: A custom **Google Apps Script** acts as the API, securely fetching and formatting data for the frontend.
- **Optimization**: Data is organized into daily sheets for historical archives and consolidated symbol sheets for trend analysis.

### 2. Frontend Experience

Built with **React** and **Vite**, the application provides a responsive and fast experience:

- **Lazy Loading**: Efficiently manages bandwidth by fetching the list of available dates first, and loading specific daily data only on demand.
- **Market Overview**: Instantly calculates and displays critical metrics such as:
  - Top Gainers and Losers
  - Total Market Volume and Turnover
  - Total Market Capitalization
- **Interactive Visualization**: Uses **Chart.js** to render visual breakdowns of price changes and turnover distributions.
- **Detailed Analysis**: A comprehensive, sortable table view for granular inspection of all listed companies.

## Technologies

- **Frontend**: React, Vite, Chart.js, Lucide React
- **Backend**: Google Apps Script
- **Database**: Google Sheets

## Getting Started

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Run the development server:
    ```bash
    npm run dev
    ```
