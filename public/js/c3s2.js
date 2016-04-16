/* vim: set ts=2 sw=2 expandtab : */
var chart;

$(function(){
	$.ajax({
		url: '/api/graph',
		data: {
						ds: '56fb8d0edead387c56e0f49a',
						dimensions: [ { name: 'DB Name', val: 'VCCBPROD' }, ],
						//names: [ 'CPU %System', 'CPU %User' ],
						category: 'Foreground Wait Class',
		},
		type: 'POST',
		success: function(result) {
			chart = c3.generate({
				bindto: "#chart",
				data: result,
				axis: { 
					x: {
						type: 'timeseries',
						tick: {
										format: '%Y-%m-%d %H:%M'
						}
					},
					y: {
            /*
						min: 0+1,
						max: 100-1,
            */
            label: '(s)',
					},
				},
				legend: {
					position: 'right',
				},
				/* zoom or subchart */
				zoom: {
					enabled: true,
				},
				/*
				subchart: {
					show: true
				},
				*/
        grid: {
          x: {
            show: true
          },
          y: {
            show: true
          }
        },
 			});
		}
	})
})


