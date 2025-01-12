import { Component, OnInit } from '@angular/core';
import { MatSelectChange } from '@angular/material/select';
import { Title } from '@angular/platform-browser';
import * as Highcharts from 'highcharts';
import { CommonService } from '../../services/common.service';
import { MsalService } from '@azure/msal-angular';
import { HttpClient } from '@angular/common/http';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { max, Subject, takeUntil } from 'rxjs';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';

@Component({
  selector: 'app-admin-overview',
  templateUrl: './admin-overview.component.html',
  styleUrl: './admin-overview.component.scss'
})
export class AdminOverviewComponent implements OnInit {
  Highcharts: typeof Highcharts = Highcharts;
  chartOptions: Highcharts.Options;
  companyName:string='K+S';
  transformedData:any;
  selectControl = new FormControl();
  searchControl = new FormControl();
  filteredOptions: string[];
  searchKeyword: string = '';
  private unsubscribe$ = new Subject<void>();

  public ngOnInit(): void {

      let isLoggedIn = this.authService.instance.getAllAccounts().length > 0;

      if  (!isLoggedIn) {
        this.authService.loginRedirect();
      }
      sessionStorage.setItem('internalUser', 'yes');

      this.cService.selectedCompany$
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(company => {
        this.companyName = company;
        if (this.companyName) {
          this.loadKSCompanyData(this.companyName);
        }
      });


      if(!sessionStorage.getItem('companyName')){
        this.companyName = 'K+S';
        sessionStorage.setItem('companyName', this.companyName);
      }else{
        this.companyName = sessionStorage.getItem('companyName');
      }

    this.loadKSCompanyData(this.companyName);
    // this.getCompanies();

    this.searchControl.valueChanges.subscribe(value => {
      this.filterOptions(value);
    })
  }

CompanyList:any;
getCompanies() {
  this.cService.getComapanyList().subscribe((res: any) => {
    this.CompanyList = res.map(company => company.shortName);
    this.filteredOptions = this.CompanyList;
  });
}

  onDropdownOpened(opened: boolean) {
    if (!opened) {
      this.searchControl.setValue('');
      this.filteredOptions = this.CompanyList;
    }
  }

  filterOptions(searchKeyword: string) {
    this.filteredOptions = this.CompanyList.filter(option =>
      option.toLowerCase().includes(searchKeyword.toLowerCase())
    );
  }

  showCharts:boolean=false;
  selectedCompany(event){
    this.companyName = event.value;
    sessionStorage.setItem('companyName', this.companyName);
   this.loadKSCompanyData(this.companyName);
  }

  loadKSCompanyData(companyName){
    this.getTotalVoyages(companyName);
    this.getTotalCargoMoved(companyName);
    this.getCo2Emmision(companyName);
    this.getInvoiceCount(companyName);
  }

  years: number[] = [];
  selectedYears: number[] = [];
  showError:boolean=false;
  isSmall:boolean=false;
  constructor(private cService: CommonService,private authService: MsalService,private http: HttpClient, private router: Router,
    private breakpointObserver: BreakpointObserver,
  ) {
    sessionStorage.setItem('internalUser', 'yes');
    this.years = this.getLastFiveYears();
    const currentYear = new Date().getFullYear();
    this.yearsControl.setValue([currentYear]);
    this.selectedYears = [currentYear];

    this.breakpointObserver.observe([
      Breakpoints.Handset,
    ]).subscribe(result => {
      this.isSmall = result.matches;
    });
  }

  getLastFiveYears(): number[] {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 4 }, (_, i) => currentYear - i);
  }

  onSelectionChange(event: MatSelectChange): void {
    const selectedYears = this.yearsControl.value;
    const currentYear = new Date().getFullYear();
    if (selectedYears.length == 0) {
      this.selectedYears = [currentYear];
    } else {
      this.selectedYears = selectedYears;
    }

    this.getTotalVoyages(this.companyName);
  }

 getSubtitle() {
    const totalNumber = Highcharts.numberFormat(this.dataSource[0].total_count, 0, '', ',') ;
    return `<span style="font-size: 40px;font-weight:700;color:#09224F">${totalNumber}</span>`;
}


commencedCount:any;
completedCount:any;
closedCount:any;
totalCount:any;
dataSource:any;
transformedInvoiceData:any;
getTotalVoyages(companyName){
  let data ={
    "crgCounterPartyShortName":companyName,
    "years": this.selectedYears
  }
  this.cService.getTotalVoyages(data).subscribe((res: any) => {
    this.dataSource = res;
    this.commencedCount = this.dataSource[0].commenced_count;
    this.completedCount=this.dataSource[0].completed_count;
    this.closedCount=this.dataSource[0].closed_count;
    this.totalCount = this.dataSource[0].total_count;
    });
}

totalDueInvoice:any;
dataFlag:boolean=false;

getInvoiceCount(companyName){
  let data ={
    "vendorShortname":companyName,
  }

  this.cService.getDashboardInvoiceCount(data).subscribe((res: any) => {
    this.dataSource = res;
    if( this.dataSource[0].current==0 && this.dataSource[0].overdue==0 ){
      this.dataFlag=true;
    }
    else{
      this.dataFlag=false;
    }
    this.totalDueInvoice = this.dataSource[0].total_outstanding_invoices;

    this.transformedInvoiceData = this.transformInvoiceResponse(this.dataSource);
    this.createChartPie(this.transformedInvoiceData );
    });
}

totalCargoMoved:any;
cargoData:any;
getTotalCargoMoved(companyName){
  let data ={
    "crgCounterPartyShortName":companyName,
  }
  this.cService.getTotalCargo(data).subscribe((res: any) => {
    this.cargoData = res;
    this.transformedCargoData = this.transformCargoData(this.cargoData);
    this.totalCargoMoved = this.extractTotalCargo(this.cargoData);
     this.createChartColumn(this.transformedCargoData.reverse());
    });

}

co2Data:any;
totalCo2:any;
getCo2Emmision(companyName){
  let data ={
    "imosshortname":companyName,
  }
  this.cService.getco2Emission(data).subscribe((res: any) => {
    this.co2Data = res;

    this.totalCo2 = this.co2Data
      .filter((item: any) => item.quarter === 'total')
      .map((item: any) => item.totalco_char)
      .reduce((sum: number, current: number) => sum + current, 0);

     this.createChartArea(this.co2Data);
    });
}


 transformResponse(data: any): any[] {
  const item = data[0];
  return [
    { name: 'In Transit', y: item.commenced_count },
    { name: 'Completed', y: item.completed_count },
  ];
}

 transformInvoiceResponse(data: any): any[] {
  const item = data[0];

  return [
    { name: 'Current ', y: item.current },
    { name: 'Overdue', y: item.overdue },
  ];
}

  transformedCargoData: { year: string, value: number }[] = [];

  transformCargoData(data:any):{ year: string, value: number }[] {
    return data
      .filter(data => data.year !== 'total')
      .map(data => ({
        year: data.year,
        value:  parseFloat((data.lifted_qty / 1e6).toFixed(2))
      }));
  }

  extractTotalCargo(data: any[]): number {
    const totalItem = data.find(item => item.year === 'total');
    return totalItem ? parseFloat((totalItem.lifted_qty / 1e6).toFixed(2)) : 0;
  }

private createChartColumn(data): void {
  const currentYear = new Date().getFullYear();
  if (data.length === 0) {
    Highcharts.chart('chart-column' as any, {
      title: {
        text: '',
      },
      credits: {
        enabled: false,
      },
      series: []
    });
    return;
  }

  const years = data.map(d => d.year);
  const values = data.map(d => d.value);

  const dataWithColors = data.map(d => ({
    y: d.value,
    color: d.year == currentYear ? '#148279' : '#005591'
  }));

  const maxValue = Math.max(...dataWithColors.map(d => d.y)); // Calculate the maximum value


  const chart = Highcharts.chart('chart-column' as any, {
    chart: {
      type: 'bar'
    },
    title: {
      text: null
    },
    legend: {
      enabled: false,
    },
    credits: {
      enabled: false,
    },
    xAxis: {
      categories: years,
      title: {
        text: null
      },
      lineWidth: 0,
    },
    yAxis: {
      min: 0,
      title: {
        text: null,
        align: 'high'
      },
      gridLineWidth: 0,
      tickInterval: 1,
      max:maxValue
    },
    plotOptions: {
      bar: {
        dataLabels: {
          enabled: true
        }
      },
      series: {
        enableMouseTracking: false,
      }
    },
    series: [{
      name: '',
      data: dataWithColors,
      pointWidth: 26,
      borderRadius: 6,
    },
    {
      name: "Background",
      data: data.map(() => maxValue + 0.5),
      color: '#F4F8FF',
      dataLabels: {
        enabled: false,
      },
      enableMouseTracking: false,
      grouping: false,
      pointPlacement: 0,
      pointWidth: 26,
      borderRadius: 7,
      zIndex: -1,
    }]
  } as any);
}

  private createChartArea(data1): void {
    let categories = [];
    const seriesData = [];

    data1.forEach((item) => {
        const category = `${item.year}`;
        if(item.quarter === 'total'){
          categories.push(category);
        }
        else{
          categories.push('');
        }

        seriesData.push({
            y: item.totalco_char,
            customQuarter: item.quarter,
            marker: {
              enabled: item.quarter === 'total',
          }
        });
    });

    const chart = Highcharts.chart(
        'chart-area' as any,
        {
            chart: {
                type: 'area',
            },
            title: {
                text: '',
            },
            credits: {
                enabled: false,
            },
            legend: {
                enabled: false,
            },
            xAxis: {
                categories: categories,
                startOnTick: true,
                min: 0,
                tickmarkPlacement: 'on',
                labels: {
                    x: -10
                },
            },
            yAxis: {
                title: {
                    text: '',
                },
            },
            plotOptions: {
                area: {
                    marker: {
                        // enabled: true,
                        symbol: 'circle',
                        radius: 4,
                        fillColor:'#EF3F3E',
                        states: {
                            hover: {
                                enabled: false,
                            },
                        },
                    },
                    lineColor: '#68BAE9',
                    lineWidth: 3,
                    color: {
                      linearGradient: {
                          x1: 0,
                          y1: 0,
                          x2: 0,
                          y2: 1
                      },
                      stops: [
                          [0, '#148279'],
                          [1, '#C9F2EF']
                      ]
                  },
                    dataLabels: {
                        enabled: true,
                        formatter: function () {
                            // Show the label only if the quarter is 'total'
                            if (this.point.customQuarter === 'total') {
                                return Highcharts.numberFormat(this.y, 0, '', ',');
                            }
                            return null;
                        },
                        style: {
                            fontWeight: 'bold',
                            color: 'white',
                        },
                        borderRadius: 5,
                        backgroundColor: 'black',
                        y: -12,
                    },
                },
            },
            tooltip: {
              enabled: false,
                formatter: function () {
                  if (this.point.customQuarter === 'total') {
                    return Highcharts.numberFormat(this.y, 0, '', ',');
                }
                return false;
                },
                backgroundColor: 'black',
                style: {
                    color: '#FFFFFF',
                },
            },
            series: [
                {
                    name: 'CO2 Emission',
                    data: seriesData,
                    showInLegend: true,
                    pointPlacement: 'on',
                },
            ],
        } as any
    );
}

private createChartPie(data:any[]): void {
  const allZero = data.every(item => item.y === 0);
  // console.log(data)
  let chart:any=[];
  chart = Highcharts.chart('chart-pie', {
    chart: {
      type: 'pie',
      align:'left',
    },
    title: {
      text: '',
    },
    credits: {
      enabled: false,
    },
    plotOptions: {
      pie: {
        borderWidth: 0,
        colorByPoint: true,
        type: 'pie',
        size: '75%',
        innerSize: '80%',
        dataLabels: {
            enabled: !allZero,
            formatter: function () {
              if (this.point.y === 0) {
                return null;
              }
              const color = this.point.index === 0 ? '#09224F' : '#FC1B1C';
              return `<span style="color: ${color};font-size:11px; text-shadow:none;font-weight:600;">${Highcharts.numberFormat(this.point.y, 0, '.', ',')}</span><br><span style="font-size:11px;font-weight:600;font-family: 'OptimaLTStd';text-shadow:none">${this.point.name}</span>`;
            },
            alignTo:'plotEdges',
            connectorWidth:2,
            connectorDashStyle:"dash",
        },
        showInLegend: false,
        enableMouseTracking:false,

    }
    },
    colors: ['#09224F','#FC1B1C'],
    series: [{
      name: null,
      innerSize: '80%',
      data: data
    }],
    tooltip:{
      enabled:false
    }
  } as any);

}


  profile: any;
  getProfile() {
    this.http.get(GRAPH_ENDPOINT)
      .subscribe(profile => {
        this.profile = profile;
      });
  }

  getSelectedYearsText() {
    const selectedCount = this.selectedYears.length;
   if (selectedCount === 1) {
      return `${this.selectedYears[0]}`;
    } else {
      return `${this.selectedYears[0]} (+${selectedCount - 1})`;
    }
  }

  yearsControl = new FormControl([]);
onYearRemoved(y: string): void {
  const years = this.yearsControl.value as string[];
  this.removeFirst(years, y);

  // Ensure at least one year remains selected
  if (years.length === 0) {
    this.yearsControl.setValue([y]); // Revert to the removed year
  } else {
    this.yearsControl.setValue(years);
  }

  this.getTotalVoyages(this.companyName);
}

  private removeFirst<T>(array: T[], toRemove: T): void {
    const index = array.indexOf(toRemove);
    if (index !== -1) {
      array.splice(index, 1);
    }
  }

  Total(){
    const yearsString = this.selectedYears.join(',');
    this.router.navigate(['/voyageDashboard', "all", yearsString],{skipLocationChange:true});
  }

  Completed(){
    const yearsString = this.selectedYears.join(',');
    this.router.navigate(['/voyageDashboard', "Completed", yearsString],{skipLocationChange:true});
  }

  Intransit(){
    const yearsString = this.selectedYears.join(',');
    this.router.navigate(['/voyageDashboard', 'Intransit', yearsString],{skipLocationChange:true});
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
}

const GRAPH_ENDPOINT = 'https://graph.microsoft.com/v1.0/me';

