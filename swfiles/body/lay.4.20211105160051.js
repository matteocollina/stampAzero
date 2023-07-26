(() => {
    let pageloader = false;
    pageloader = {pageloader: true, pageloaderStop: true, }?.pageloader;
    
    if (pageloader) {
        document.documentElement.style.setProperty('--sm-loader-display-smC11783SmSn1p3T8-style', 'flex');
    }
    
    document.addEventListener('DOMContentLoaded', e => {
        const smLoader = new SM_Loader({
            id: '11783SmSn1p3T8',
            pageloader: true, pageloaderStop: true, 
        });
    });
})();
document.addEventListener('DOMContentLoaded', e => {
    
    cookieModal = new SM_CookiesModal({
        wrapperId: 's-cookie__modal76',
        closeMethods: [],
        designMode: false, showOnLoad: false, delay: 1000, enableAll: true, forceReload: false, 
    });
    
});
$(document).ready(function() {
    
    /***********************
        STICKY ANIMATION
    ***********************/
    
    $(document).scroll(function () {
        
        var y = $(this).scrollTop();
        
        if (y > 150) {
            $('.s-header-1.sticky').addClass("reveal");
        }
        
        else {
            $('.s-header-1.sticky').removeClass("reveal");
        }
    
    });
        
    /***********************
        MOBILE BUTTON CLICK ACTIONS
    ***********************/
    
    $(".mobile-nav-btn").click(function() {
        
        if ( jQuery("#mobile").hasClass("mobile-active") ) {
            jQuery("#mobile").removeClass("mobile-active");
            jQuery("body").css("overflow", "visible");
            jQuery(".s-header-1 #mobile .mobile-overlay > ul").removeClass("has-sub");
            jQuery("a[href*='#']").siblings().removeClass("sub-visible");
        }
        else {
            jQuery("#mobile").addClass("mobile-active");
            jQuery("body").css("overflow", "hidden");
        }
        
    });
    
    /***********************
        MOBILE SUB MENU CLICK ACTIONS
    ***********************/
    
    /*
    $(".s-header-1 a[href*='#']").click(function() {
        $(".s-header-1 #mobile .mobile-overlay > ul").addClass("has-sub");
        $(this).siblings().addClass("sub-visible");
        $(".mobile-subnav-btn").addClass("back-visible");
    });
    */
    
    /***********************
        MOBILE BACK BUTTON CLICK ACTIONS
    ***********************/
    
    /*
    $(".mobile-subnav-btn").click(function() {
        $(".s-header-1 #mobile .mobile-overlay > ul").removeClass("has-sub");
        $(".s-header-1 .header-nav#mobile ul > li > ul").removeClass("sub-visible");
        $(".mobile-subnav-btn").removeClass("back-visible");
    });
    */
    
    /***********************
        ACTIVE PAGE DETECTION
    ***********************/
    
    var link_url;

    $(".s-header-1 ul a").each(function(){
        
        var pathname = window.location.pathname;
        $('.s-header-1 ul a[href="'+pathname+'"]').addClass('active');
        $('.s-header-1 ul a[href="'+pathname+'"]').closest('ul').siblings('a').addClass('active');
    
    });
    
});

$(document).scroll(function () {
        
        var y = $(this).scrollTop();
        
        if (y > 150) {
            $('.cta-nav, .full-nav').addClass("reveal");
        }
        
        else {
            $('.cta-nav, .full-nav').removeClass("reveal");
        }
    
    });
document.addEventListener('DOMContentLoaded', () => {
    new SM_Breadcrumbs({
        id: '19022SmSn1p3T8',
        showHome: false, homeIcon: false, delimiter: '/', truncate: true, 
    });
});
